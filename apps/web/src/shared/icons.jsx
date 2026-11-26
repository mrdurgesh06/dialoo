import React, { useState } from 'react';
import {
  Banknote, Bell, Bike, BriefcaseBusiness, BrickWall, Camera, CarFront, CircleCheck, CirclePlus, CircleX, GraduationCap, Hammer, HardHat,
  Hourglass, House, Megaphone, MessageCircle, Navigation, PaintRoller, PawPrint, Scissors, Siren, Snowflake, Sparkles, Star, Store, Tractor,
  WashingMachine, Wrench, Zap,
} from 'lucide-react';

/**
 * Category icons. The catalogue stores an emoji per category; the UI shows Lucide icons instead.
 * Matching is by slug/name keywords (never by numeric id) so new categories fall back gracefully.
 */
const CATEGORY_ICONS = [
  [/electric/, Zap],
  [/plumb/, Wrench],
  [/carpent/, Hammer],
  [/clean/, Sparkles],
  [/(^|[\s-])car([\s-]|$)/, CarFront],
  [/bike/, Bike],
  [/beauty|parlour|salon/, Scissors],
  [/laundry/, WashingMachine],
  [/maintenance/, House],
  [/(^|[\s-])ac([\s-]|$)|appliance/, Snowflake],
  [/shop/, Store],
  [/tutor/, GraduationCap],
  [/paint/, PaintRoller],
  [/mason|labour/, BrickWall],
  [/agri|tractor/, Tractor],
  [/photo/, Camera],
  [/pet/, PawPrint],
];

export function categoryIcon(key = '') {
  const k = String(key || '').toLowerCase();
  for (const [re, Icon] of CATEGORY_ICONS) if (re.test(k)) return Icon;
  return BriefcaseBusiness;
}

export function CategoryIcon({ slug, name, ...props }) {
  const Icon = categoryIcon(slug || name);
  return <Icon aria-hidden="true" {...props} />;
}

/** Notification type -> Lucide icon. */
const NOTIFICATION_ICONS = [
  ['REQUESTED', CirclePlus], ['ACCEPTED', CircleCheck], ['ON_THE_WAY', Navigation], ['IN_PROGRESS', Wrench],
  ['COMPLETED', CircleCheck], ['CANCEL', CircleX], ['REJECT', CircleX], ['EXPIRED', Hourglass], ['PAID', Banknote],
  ['CHAT', MessageCircle], ['REVIEW', Star], ['EMERGENCY', Siren], ['PROVIDER', HardHat], ['BROADCAST', Megaphone],
];

export function NotificationIcon({ type = '', ...props }) {
  const hit = NOTIFICATION_ICONS.find(([k]) => type.includes(k));
  const Icon = hit ? hit[1] : Bell;
  return <Icon aria-hidden="true" {...props} />;
}

/**
 * Illustrated service icon (public/service-icons/<category-slug>.webp).
 * Falls back to the Lucide category icon when a category has no illustration or the file fails to load.
 */
const ILLUSTRATED = new Set(['electrician', 'plumber', 'carpenter', 'house-cleaning', 'car-repair', 'bike-repair', 'beauty-parlour', 'laundry', 'home-maintenance',
  'ac-appliance-repair', 'local-shops', 'painter', 'mason-labour', 'agri-equipment', 'pest-control', 'ro-water-purifier', 'cctv-security', 'mobile-laptop-repair', 'tutor',
  'computer-networking', 'gardener', 'packers-movers', 'photographer', 'cook-chef', 'driver-on-demand', 'welder-fabrication', 'tiles-flooring', 'waterproofing',
  'solar-panel', 'tailor', 'nurse-elder-care', 'yoga-fitness', 'car-wash', 'tyre-shop', 'glass-aluminium', 'interior-designer', 'mehndi-artist', 'event-tent-decor',
  'dj-sound', 'sofa-carpet-cleaning', 'music-dance-classes', 'locksmith', 'inverter-generator', 'pet-care', 'barber']);

/** Which illustration file (if any) belongs to a category. Barber/salon style slugs share the barber artwork. */
export function illustrationFor(slug = '', name = '') {
  if (ILLUSTRATED.has(slug)) return slug;
  if (/barber|salon|hair|men-s-grooming/i.test(`${slug} ${name}`) && !/beauty|parlour/i.test(`${slug} ${name}`)) return 'barber';
  return null;
}

export function ServiceIcon({ slug, name, size = 26 }) {
  const [bad, setBad] = useState(false);
  const file = illustrationFor(slug, name);
  if (file && !bad) {
    return <img className="svc-img" src={`/service-icons/${file}.webp`} alt="" width="256" height="256" loading="lazy" decoding="async" draggable="false" onError={() => setBad(true)} />;
  }
  return <CategoryIcon slug={slug} name={name} size={size} strokeWidth={1.9} />;
}
