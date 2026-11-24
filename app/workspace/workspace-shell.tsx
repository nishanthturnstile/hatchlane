"use client";

import {
  Building2Icon,
  CheckIcon,
  ChevronsUpDownIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MapIcon,
  PlusIcon,
  SettingsIcon,
} from "lucide-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { type ReactNode, useRef, useState } from "react";
import { Brand } from "@/components/account/brand";
import { CreateSiteSetup } from "@/components/account/create-site-setup";
import { useSignOut } from "@/components/account/sign-out";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { explorerPath } from "@/lib/account-paths";
import type { MapSource } from "@/lib/site-map";

type Site = { id: string; name: string };
type Account = { name: string; email: string };
type WorkspaceNavigation = {
  account: Account;
  canCreateSite: boolean;
  sites: Site[];
  mapSource: MapSource | null;
};

export function WorkspaceShell({
  children,
  defaultOpen,
  ...navigation
}: WorkspaceNavigation & { children: ReactNode; defaultOpen: boolean }) {
  const { siteId } = useParams<{ siteId?: string }>();
  const pathname = usePathname();
  const activeSite = navigation.sites.find((site) => site.id === siteId);
  const fullWidth = activeSite && pathname === explorerPath(activeSite.id);

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <WorkspaceSidebar {...navigation} activeSite={activeSite} />
      <SidebarInset className="min-w-0 bg-muted">
        <header className="flex min-h-14 items-center gap-3 border-b bg-background px-3 sm:px-5">
          <SidebarTrigger className="size-12" />
          <span className="truncate text-sm font-medium">
            {activeSite?.name ?? "Workspace"}
          </span>
        </header>
        <div
          className={
            fullWidth
              ? "w-full"
              : "mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 md:py-10"
          }
        >
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function WorkspaceSidebar({
  account,
  activeSite,
  canCreateSite,
  mapSource,
  sites,
}: WorkspaceNavigation & { activeSite?: Site }) {
  const { setOpenMobile } = useSidebar();
  const [createOpen, setCreateOpen] = useState(false);
  const switcher = useRef<HTMLButtonElement>(null);
  const path = usePathname();
  const overview = activeSite ? `/workspace/${activeSite.id}` : "/workspace";
  const explorer = activeSite ? explorerPath(activeSite.id) : null;
  const closeMobile = () => setOpenMobile(false);

  return (
    <Sidebar>
      <SidebarHeader className="gap-3 border-b border-sidebar-border p-3">
        <Brand href={overview} onNavigate={closeMobile} />
        {(sites.length > 0 || canCreateSite) && (
          <SidebarMenu>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger
                  ref={switcher}
                  aria-label={
                    activeSite
                      ? `Switch site, ${activeSite.name}`
                      : "Switch site"
                  }
                  render={<SidebarMenuButton variant="outline" />}
                  className="min-h-12"
                >
                  <Building2Icon aria-hidden="true" />
                  <span className="truncate">
                    {activeSite?.name ?? "Select a site"}
                  </span>
                  <ChevronsUpDownIcon aria-hidden="true" className="ml-auto" />
                </DropdownMenuTrigger>
                <DropdownMenuContent sideOffset={6}>
                  {sites.length > 0 && (
                    <DropdownMenuGroup>
                      <DropdownMenuLabel>Your sites</DropdownMenuLabel>
                      {sites.map((site) => (
                        <DropdownMenuItem
                          key={site.id}
                          className="min-h-12"
                          render={
                            <Link
                              href={`/workspace/${site.id}`}
                              onNavigate={closeMobile}
                              aria-current={
                                site.id === activeSite?.id ? "page" : undefined
                              }
                            />
                          }
                        >
                          <Building2Icon aria-hidden="true" />
                          <span className="truncate">{site.name}</span>
                          {site.id === activeSite?.id && (
                            <CheckIcon aria-hidden="true" className="ml-auto" />
                          )}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuGroup>
                  )}
                  {canCreateSite && (
                    <>
                      {sites.length > 0 && <DropdownMenuSeparator />}
                      <DropdownMenuGroup>
                        <DropdownMenuItem
                          className="min-h-12"
                          onClick={() => setCreateOpen(true)}
                        >
                          <PlusIcon aria-hidden="true" />
                          Create site
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
      </SidebarHeader>
      <SidebarContent className="p-3">
        <nav aria-label="Workspace">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={path === overview}
                className="min-h-12"
                render={
                  <Link
                    href={overview}
                    onNavigate={closeMobile}
                    aria-current={path === overview ? "page" : undefined}
                  />
                }
              >
                <LayoutDashboardIcon aria-hidden="true" />
                <span>Overview</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
            {explorer && (
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={path === explorer}
                  className="min-h-12"
                  render={
                    <Link
                      href={explorer}
                      onNavigate={closeMobile}
                      aria-current={path === explorer ? "page" : undefined}
                    />
                  }
                >
                  <MapIcon aria-hidden="true" />
                  <span>Site Explorer</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )}
          </SidebarMenu>
        </nav>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-3">
        <AccountMenu account={account} />
      </SidebarFooter>
      {canCreateSite && (
        <CreateSiteSetup
          source={mapSource}
          dialog={{
            open: createOpen,
            onClose: () => setCreateOpen(false),
            finalFocus: switcher,
          }}
        />
      )}
    </Sidebar>
  );
}

function AccountMenu({ account }: { account: Account }) {
  const { setOpenMobile } = useSidebar();
  const { pending, error, signOut } = useSignOut();
  const initials = account.name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => Array.from(part)[0])
    .join("")
    .toUpperCase();

  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`Account menu for ${account.name}`}
              render={<SidebarMenuButton size="lg" />}
            >
              <Avatar aria-hidden="true">
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <span className="grid min-w-0 flex-1 text-left leading-tight">
                <span className="truncate font-medium">{account.name}</span>
                <span className="truncate text-xs">{account.email}</span>
              </span>
              <ChevronsUpDownIcon aria-hidden="true" />
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" sideOffset={6}>
              <DropdownMenuGroup>
                <DropdownMenuItem
                  className="min-h-12"
                  render={
                    <Link
                      href="/workspace/account/settings"
                      onNavigate={() => setOpenMobile(false)}
                    />
                  }
                >
                  <SettingsIcon aria-hidden="true" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="min-h-12"
                  disabled={pending}
                  onClick={signOut}
                >
                  <LogOutIcon aria-hidden="true" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
      {error && (
        <p role="alert" className="px-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </>
  );
}
