package com.narayanix.dialoo.controller;

import com.narayanix.dialoo.service.CurrentUser;
import com.narayanix.dialoo.service.PricingService;
import com.narayanix.dialoo.service.Sql;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Map;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

/** Signed-in customer extras: checkout price preview, favourites, saved addresses. */
@RestController @RequestMapping("/api/v1")
public class CustomerController {
  public record PreviewReq(@NotNull Long providerId, Long serviceId, String couponCode) {}
  /** Original three fields stay as they were; everything after isDefault is optional (structured address + map pin from the location selector). */
  public record AddressReq(@Pattern(regexp = "HOME|OFFICE|FARM|SHOP|OTHER") String label, @NotBlank @Size(max = 255) String addressLine, Boolean isDefault,
      @DecimalMin("-90") @DecimalMax("90") Double latitude, @DecimalMin("-180") @DecimalMax("180") Double longitude, @Size(max = 255) String placeId,
      @Size(max = 60) String houseNo, @Size(max = 160) String building, @Size(max = 120) String landmark, @Size(max = 120) String locality,
      @Size(max = 80) String district, @Size(max = 80) String state, @Size(max = 10) String pincode, @Size(max = 60) String country) {}

  private final JdbcTemplate db; private final CurrentUser me; private final PricingService pricing; private final Sql sql;
  public CustomerController(JdbcTemplate db, CurrentUser me, PricingService pricing, Sql sql) { this.db = db; this.me = me; this.pricing = pricing; this.sql = sql; }

  @PostMapping("/checkout/preview") public Map<String, Object> preview(@Valid @RequestBody PreviewReq r, Authentication a) {
    long uid = me.id(a);
    if (db.queryForList("SELECT id FROM providers WHERE id=? AND status='APPROVED'", Long.class, r.providerId()).isEmpty()) throw new IllegalArgumentException("Provider not found or not approved");
    var q = pricing.quote(r.providerId(), r.serviceId(), uid, r.couponCode());
    return Map.of("serviceAmount", q.serviceAmount(), "visitFee", q.visitFee(), "taxAmount", q.taxAmount(), "discount", q.discount(),
      "total", q.total(), "couponApplied", q.couponCode() != null, "couponMessage", q.couponMessage() == null ? "" : q.couponMessage());
  }

  @GetMapping("/me/favourites") public List<Long> favourites(Authentication a) {
    return db.queryForList("SELECT provider_id FROM favourite_providers WHERE user_id=? ORDER BY id DESC", Long.class, me.id(a));
  }
  @PostMapping("/me/favourites/{providerId}") public Map<String, Object> addFav(@PathVariable long providerId, Authentication a) {
    db.update("INSERT IGNORE INTO favourite_providers(user_id,provider_id) VALUES(?,?)", me.id(a), providerId);
    return Map.of("favourite", true);
  }
  @DeleteMapping("/me/favourites/{providerId}") public Map<String, Object> removeFav(@PathVariable long providerId, Authentication a) {
    db.update("DELETE FROM favourite_providers WHERE user_id=? AND provider_id=?", me.id(a), providerId);
    return Map.of("favourite", false);
  }

  @GetMapping("/me/addresses") public List<Map<String, Object>> addresses(Authentication a) {
    return db.queryForList("SELECT id,label,address_line,is_default,latitude,longitude,place_id,house_no,building,landmark,locality,district,state,pincode,country FROM customer_addresses WHERE user_id=? AND deleted_at IS NULL ORDER BY is_default DESC,id DESC", me.id(a));
  }
  @PostMapping("/me/addresses") public Map<String, Object> addAddress(@Valid @RequestBody AddressReq r, Authentication a) {
    long uid = me.id(a);
    Integer count = db.queryForObject("SELECT COUNT(*) FROM customer_addresses WHERE user_id=? AND deleted_at IS NULL", Integer.class, uid);
    if (count != null && count >= 10) throw new IllegalArgumentException("You can save up to 10 addresses.");
    boolean def = Boolean.TRUE.equals(r.isDefault()) || count == null || count == 0;
    if (def) db.update("UPDATE customer_addresses SET is_default=FALSE WHERE user_id=?", uid);
    long id = sql.insert("INSERT INTO customer_addresses(user_id,label,address_line,is_default,latitude,longitude,place_id,house_no,building,landmark,locality,district,state,pincode,country,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,UTC_TIMESTAMP())",
      uid, r.label() == null ? "HOME" : r.label(), r.addressLine().trim(), def, r.latitude(), r.longitude(), blank(r.placeId()), blank(r.houseNo()), blank(r.building()), blank(r.landmark()),
      blank(r.locality()), blank(r.district()), blank(r.state()), blank(r.pincode()), blank(r.country()));
    return Map.of("id", id);
  }
  @PutMapping("/me/addresses/{id}") public Map<String, Object> updateAddress(@PathVariable long id, @Valid @RequestBody AddressReq r, Authentication a) {
    long uid = me.id(a);
    if (Boolean.TRUE.equals(r.isDefault())) db.update("UPDATE customer_addresses SET is_default=FALSE WHERE user_id=?", uid);
    int n = db.update("UPDATE customer_addresses SET label=?,address_line=?,is_default=IF(?,TRUE,is_default),latitude=?,longitude=?,place_id=?,house_no=?,building=?,landmark=?,locality=?,district=?,state=?,pincode=?,country=?,updated_at=UTC_TIMESTAMP() WHERE id=? AND user_id=? AND deleted_at IS NULL",
      r.label() == null ? "HOME" : r.label(), r.addressLine().trim(), Boolean.TRUE.equals(r.isDefault()), r.latitude(), r.longitude(), blank(r.placeId()), blank(r.houseNo()), blank(r.building()), blank(r.landmark()),
      blank(r.locality()), blank(r.district()), blank(r.state()), blank(r.pincode()), blank(r.country()), id, uid);
    if (n == 0) throw new IllegalArgumentException("Address not found");
    return Map.of("id", id);   // bookings keep their own immutable copy of the address text and coordinates, so editing a saved address never changes an existing booking
  }
  private static String blank(String v) { return v == null || v.isBlank() ? null : v.trim(); }
  @DeleteMapping("/me/addresses/{id}") public Map<String, Object> deleteAddress(@PathVariable long id, Authentication a) {
    db.update("UPDATE customer_addresses SET deleted_at=UTC_TIMESTAMP(), is_default=FALSE WHERE id=? AND user_id=?", id, me.id(a));
    return Map.of("deleted", true);
  }
}
