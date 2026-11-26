package com.narayanix.dialoo.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/** Price breakdown + coupon rules, shared by the checkout preview and the real booking so both always agree. */
@Service
public class PricingService {
  public record Quote(BigDecimal serviceAmount, BigDecimal visitFee, BigDecimal taxAmount, BigDecimal discount, BigDecimal total, String couponCode, String couponMessage) {}

  private final JdbcTemplate db; private final SettingsService settings;
  public PricingService(JdbcTemplate db, SettingsService settings) { this.db = db; this.settings = settings; }

  public Quote quote(long providerId, Long serviceId, long customerId, String couponCode) {
    Map<String, Object> p = db.queryForMap("SELECT p.price_from, c.base_visit_fee FROM providers p JOIN categories c ON c.id=p.category_id WHERE p.id=?", providerId);
    BigDecimal service = (BigDecimal) p.get("price_from");
    if (serviceId != null) {
      List<BigDecimal> sp = db.queryForList("SELECT price FROM provider_services WHERE provider_id=? AND service_id=?", BigDecimal.class, providerId, serviceId);
      if (!sp.isEmpty()) service = sp.get(0);
      else {
        List<BigDecimal> base = db.queryForList("SELECT base_price FROM services WHERE id=? AND is_active=TRUE", BigDecimal.class, serviceId);
        if (!base.isEmpty()) service = base.get(0);
      }
    }
    BigDecimal visit = ((BigDecimal) p.get("base_visit_fee")).add(settings.getDecimal("PLATFORM_FEE", "0"));
    BigDecimal tax = service.multiply(settings.getDecimal("TAX_PERCENT", "5")).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
    BigDecimal subtotal = service.add(visit);
    BigDecimal discount = BigDecimal.ZERO; String applied = null; String message = null;
    if (couponCode != null && !couponCode.isBlank()) {
      if (!settings.flag("COUPONS_ENABLED", true)) { message = "Coupons are currently disabled."; }
      else {
        String err = null;
        List<Map<String, Object>> rows = db.queryForList("SELECT * FROM coupons WHERE code=? AND is_active=TRUE AND valid_from<=UTC_TIMESTAMP() AND (valid_until IS NULL OR valid_until>UTC_TIMESTAMP())", couponCode.trim().toUpperCase());
        if (rows.isEmpty()) err = "Coupon is invalid or expired.";
        else {
          Map<String, Object> c = rows.get(0); long couponId = ((Number) c.get("id")).longValue();
          if (subtotal.compareTo((BigDecimal) c.get("min_order")) < 0) err = "Add more to use this coupon (minimum ₹" + ((BigDecimal) c.get("min_order")).stripTrailingZeros().toPlainString() + ").";
          else if (c.get("usage_limit") != null && ((Number) c.get("used_count")).intValue() >= ((Number) c.get("usage_limit")).intValue()) err = "Coupon usage limit reached.";
          else {
            Integer used = db.queryForObject("SELECT COUNT(*) FROM coupon_redemptions WHERE coupon_id=? AND user_id=?", Integer.class, couponId, customerId);
            if (used != null && used >= ((Number) c.get("per_user_limit")).intValue()) err = "You have already used this coupon.";
            else if (Boolean.TRUE.equals(c.get("first_booking_only"))) {
              Integer prior = db.queryForObject("SELECT COUNT(*) FROM bookings WHERE customer_id=? AND status NOT IN ('CANCELLED','REJECTED','EXPIRED')", Integer.class, customerId);
              if (prior != null && prior > 0) err = "This coupon is only for your first booking.";
            }
          }
          if (err == null) {
            BigDecimal v = (BigDecimal) c.get("discount_value");
            discount = "PERCENT".equals(c.get("discount_type")) ? subtotal.multiply(v).divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP) : v;
            if (c.get("max_discount") != null && discount.compareTo((BigDecimal) c.get("max_discount")) > 0) discount = (BigDecimal) c.get("max_discount");
            if (discount.compareTo(subtotal) > 0) discount = subtotal;
            applied = (String) c.get("code"); message = "Coupon applied. You save ₹" + discount.stripTrailingZeros().toPlainString();
          }
        }
        if (err != null) message = err;
      }
    }
    BigDecimal total = subtotal.add(tax).subtract(discount).max(BigDecimal.ZERO);
    return new Quote(service, visit, tax, discount, total, applied, message);
  }
}
