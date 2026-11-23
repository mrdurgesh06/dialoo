package com.narayanix.dialoo.service;

import java.security.SecureRandom;

/** One place for the staff password rules and for generating one-time temporary passwords. */
public final class PasswordPolicy {
  private PasswordPolicy() {}
  private static final SecureRandom RANDOM = new SecureRandom();
  private static final String UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ", LOWER = "abcdefghijkmnopqrstuvwxyz", DIGIT = "23456789", SPECIAL = "@#$%&*!?";

  /** Throws IllegalArgumentException with a clear message when the password is too weak. */
  public static void check(String pw) {
    if (pw == null || pw.length() < 12) throw new IllegalArgumentException("Password must be at least 12 characters.");
    if (pw.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 72) throw new IllegalArgumentException("Password is too long (maximum 72 characters).");
    if (!pw.matches(".*[a-z].*") || !pw.matches(".*[A-Z].*") || !pw.matches(".*[0-9].*") || !pw.matches(".*[^A-Za-z0-9].*"))
      throw new IllegalArgumentException("Password needs a small letter, a CAPITAL letter, a number and a symbol (like @ # $ !).");
    if (!pw.equals(pw.trim())) throw new IllegalArgumentException("Password cannot start or end with a space.");
  }

  /** 14-character temporary password that always satisfies check() and avoids look-alike characters. */
  public static String generateTemp() {
    String all = UPPER + LOWER + DIGIT + SPECIAL;
    StringBuilder sb = new StringBuilder();
    sb.append(pick(UPPER)).append(pick(LOWER)).append(pick(DIGIT)).append(pick(SPECIAL));
    while (sb.length() < 14) sb.append(pick(all));
    char[] c = sb.toString().toCharArray();
    for (int i = c.length - 1; i > 0; i--) { int j = RANDOM.nextInt(i + 1); char t = c[i]; c[i] = c[j]; c[j] = t; }
    return new String(c);
  }
  private static char pick(String s) { return s.charAt(RANDOM.nextInt(s.length())); }
}
