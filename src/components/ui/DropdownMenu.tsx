import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuPortal = DropdownMenuPrimitive.Portal;
export const DropdownMenuContent = DropdownMenuPrimitive.Content;
export const DropdownMenuItem = DropdownMenuPrimitive.Item;
export const DropdownMenuSeparator = DropdownMenuPrimitive.Separator;

const contentClass = 'min-w-[160px] rounded-lg border border-border bg-white shadow-lg py-1 z-[100]';
const itemClass = 'px-3 py-2 text-sm outline-none cursor-pointer hover:bg-slate-100 data-[highlighted]:bg-slate-100';

export function DropdownMenuContentStyled({ children, className = '', ...props }: { children: ReactNode; className?: string } & ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>) {
  return (
    <DropdownMenuPrimitive.Content className={`${contentClass} ${className}`} sideOffset={4} {...props}>
      {children}
    </DropdownMenuPrimitive.Content>
  );
}

export function DropdownMenuItemStyled({ children, className = '', ...props }: { children: ReactNode; className?: string } & ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item>) {
  return (
    <DropdownMenuPrimitive.Item className={`${itemClass} ${className}`} {...props}>
      {children}
    </DropdownMenuPrimitive.Item>
  );
}
