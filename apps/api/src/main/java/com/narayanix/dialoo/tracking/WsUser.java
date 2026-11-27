package com.narayanix.dialoo.tracking;

import java.security.Principal;

/** Authenticated STOMP user. Built only from a verified JWT + live database state (never from client-supplied fields). */
public final class WsUser implements Principal {
  private final String phone; private final long userId; private final String role; private final String actor; private final long expiresAtMs;
  public WsUser(String phone, long userId, String role, String actor, long expiresAtMs) { this.phone = phone; this.userId = userId; this.role = role; this.actor = actor; this.expiresAtMs = expiresAtMs; }
  @Override public String getName() { return phone; }
  public long userId() { return userId; }
  public String role() { return role; }
  public String actor() { return actor; }
  public boolean expired() { return System.currentTimeMillis() >= expiresAtMs; }
  public boolean isStaff() { return "ADMIN".equals(role) || "SUPER_ADMIN".equals(role) || "SUPPORT".equals(role); }
}
