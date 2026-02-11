/**
 * Bottom nav: master list of eligible items. User customizes order/visibility in Settings.
 */

import type { ComponentType } from 'react';
import {
  Home,
  Calendar,
  MessageCircle,
  Users,
  Settings,
  List,
  ClipboardList,
  ClipboardCheck,
  CircleDollarSign,
  Heart,
  CloudUpload,
} from 'lucide-react';

export interface NavItemConfig {
  id: string;
  path: string;
  label: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Icon: ComponentType<any>;
}

export const ALL_NAV_ITEMS: NavItemConfig[] = [
  { id: 'dashboard', path: '/', label: 'Dashboard', Icon: Home },
  { id: 'hallway', path: '/hallway', label: 'Schedule', Icon: Calendar },
  { id: 'messages', path: '/messages', label: 'Messages', Icon: MessageCircle },
  { id: 'contacts', path: '/contacts', label: 'Contacts', Icon: Users },
  { id: 'day', path: '/day', label: 'Day view', Icon: List },
  { id: 'schedules', path: '/schedules', label: 'Schedules', Icon: ClipboardList },
  { id: 'interviews-to-get', path: '/interviews-to-get', label: 'Interviews', Icon: ClipboardCheck },
  { id: 'tithing', path: '/tithing', label: 'Tithing', Icon: CircleDollarSign },
  { id: 'prayer', path: '/prayer', label: 'Prayer', Icon: Heart },
  { id: 'settings', path: '/settings', label: 'Settings', Icon: Settings },
  { id: 'backup', path: '/backup', label: 'Backup', Icon: CloudUpload },
];

export const DEFAULT_NAV_ORDER: string[] = ['dashboard', 'hallway', 'messages', 'contacts', 'settings'];

export const NAV_SETTINGS_KEY = 'navOrder';

export function getNavItemsByIds(ids: string[]): NavItemConfig[] {
  const byId = new Map(ALL_NAV_ITEMS.map((item) => [item.id, item]));
  return ids.map((id) => byId.get(id)).filter(Boolean) as NavItemConfig[];
}

export function getAllNavPaths(): string[] {
  return ALL_NAV_ITEMS.map((item) => item.path);
}
