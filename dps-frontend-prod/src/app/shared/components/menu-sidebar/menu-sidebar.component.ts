import { Component, ElementRef, OnInit, QueryList, ViewChildren } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { SidebarElementComponent } from '@/app/shared/components/sidebar-element/sidebar-element.component';
import { MenuSidebar, AnyMenuItem } from '@/app/shared/interfaces/menu-sidebar.interface';
import { ProfilesService } from '@/app/services/security/profiles/profiles.service';
import { AuthMeService } from '@/app/services/auth/auth-me/auth-me.service';
import { SharedService } from '@/app/services/shared/shared.service';
import { Subscription } from 'rxjs';

@Component({
    selector: 'menu-sidebar',
    imports: [RouterLink, SidebarElementComponent, CommonModule, RouterLinkActive],
    templateUrl: './menu-sidebar.component.html',
    styleUrl: './menu-sidebar.component.css'
})
export class MenuSidebarComponent implements OnInit {
  constructor(
    private profileService: ProfilesService,
    private authMeService: AuthMeService,
    private sharedService: SharedService,
    private router: Router
  ) {
    console.info('[MenuSidebarComponent] Constructor initialized');
  }

  @ViewChildren('asLink') links!: QueryList<ElementRef>;
  iconByOption: any = {
    "/dashboard": "GAUGE",
    "/comercios": "SHOPPING_CART",
    "/clientes": "USERS",
    "/dispositivos": "MOBILE",
    "/tarjetas": "CREDIT_CARD",
    "/links-de-pago": "LINK",
    "/movimientos": "GLOBE",
    "/movimientos/transacciones": "WALLET",
    "/movimientos/pos-json": "RECEIPT",
    "/movimientos/tickets": "RECEIPT",
    "/movimientos/contracargos": "RECEIPT",
    "/archivos": "FILE",
    "/archivos/conciliation": "RECEIPT",
    "/archivos/contracharges": "RECEIPT",
    "/archivos/liquidation": "RECEIPT",
    "/catalogos": "BOOK",
    "/catalogos/agregadores": "RECEIPT",
    "/catalogos/tipo-de-personas": "RECEIPT",
    "/catalogos/esq-transaccional": "RECEIPT",
    "/catalogos/url-destino": "LINK",
    "/catalogos/modo-transaccion": "RECEIPT",
    "/catalogos/giros": "RECEIPT",
    "/catalogos/bancos": "RECEIPT",
    "/catalogos/red-logica": "RECEIPT",
    "/catalogos/procesadores": "RECEIPT",
    "/catalogos/perfil-transaccional": "RECEIPT",
    "/security": "SHIELD",
    "/usuarios": "ico-user",
    "/profiles": "ico-user",
    "/usuarios-tdm": "ico-user",
    "/dispersion": "ico-report",
    "/estado-cuenta": "ico-report",
    "/logout": "SIGN_OUT",
    "config": "COG",
    // Existing mappings that should be preserved
    "/merchant": "SHOPPING_CART",
    "/terminals": "MOBILE",
    "/cat/clientes": "USERS",
    "/consolidate": "CHART_BAR",
    "/permissions-manager": "KEY",
    "/permission-tester": "TEST",
    "/activities": "ACTIVITIES",
    "/movimientos/transacciones-mejoradas": "WALLET_ENHANCED",
    "/report/liquidation": "RECEIPT",
    "/conciliation": "FILE",
    "/files/contracargo": "FILE",
    "/files/liquidacion": "FILE",
    "/link": "LINK",
    "/link/links": "LINK",
    "/cat/tipoPersona": "BOOK",
    "/cat/tipoEsquema": "BOOK",
    "/cat/mcc": "BOOK",
    "/cat/bancoAdq": "BOOK",
    "/cat/tipoRed": "BOOK",
    "/cat/processador": "BOOK",
    "/cat/modoTransaccion": "BOOK",
    "/cat/urlDestino": "BOOK",
    "/catalogos/mcc-operations": "SETTINGS",
    "/catalogos/mcc-operations/management": "COG",
    "/profile_transaction": "BOOK",
    "/cat/users": "USERS",
    "/cat/profiles": "PROFILES",
    "/cat/tdm/users": "USERS",
    "/processors": "PROCESSORS",
    "/bines": "CREDIT_CARD",
    "/database-explorer": "DATABASE"
  };

  iconByResourceName: any = {
    "Dashboard": "GAUGE",
    "Comercios": "SHOPPING_CART",
    "Terminales": "MOBILE",
    "Tarjetas": "CREDIT_CARD",
    "Clientes": "USERS",
    "Instituciones": "BANK",
    "Movimientos": "GLOBE",
    "Transaccionales": "FOLDER",
    "Archivos": "FILE",
    "Links": "LINK",
    "Catálogos": "BOOK",
    "Seguridad": "SHIELD",
    "Reportes": "CHART_BAR",
    "Configuración": "COG"
  };

  optionsExclude = [""];
  items: MenuSidebar[] = [];
  currentUser: any = null;

  ngOnInit(): void {
    console.info('[MenuSidebarComponent] Initializing menu system...');
    this.sharedService.userInfo$.subscribe({
      next: (user) => {
        console.log('👤 MenuSidebar: User info received:', user);
        console.log('🆔 MenuSidebar: User profile ID:', user?.userProfile);
        console.log('🔍 MenuSidebar: Full user object keys:', Object.keys(user || {}));
        console.log('🔍 MenuSidebar: User object details:', JSON.stringify(user, null, 2));
        this.currentUser = user;
        this.getMenuData(user?.userProfile);
      },
      error: (error) => {
        console.error('❌ MenuSidebar: Error en autenticación:', error);
      }
    });
  }

  getMenuData(id?: number): void {
    console.log('🔍 MenuSidebar: Getting menu data for profile ID:', id);
    if (!id) {
      console.warn('⚠️ MenuSidebar: No profile ID provided, menu will be empty');
      this.items = [];
      return;
    }
    this.profileService.getProfilesResoucesById(id).subscribe({
      next: (response: any) => {
        console.log('📋 MenuSidebar: Profile resources received:', response.data);
        let dataArray = response.data || response;
        if (!Array.isArray(dataArray)) {
          console.warn("DEBUG: Response data is not an array:", response);
          this.items = [];
          return;
        }
        console.log("DEBUG: Final data array:", dataArray);
        this.createMenu(dataArray);
        this.sharedService.shareProfilePermissions(dataArray);
      },
      error: (error) => {
        console.error('❌ MenuSidebar: Error al obtener los perfiles:', error);
        this.items = [];
      }
    });
  }

  buildMenuTree(items: any[], parentId: number | null = null): any[] {
    const result: any[] = [];
    const children = items.filter(item => item.father_resource === parentId);

    for (const child of children) {
      const hasChildren = items.some(item => item.father_resource === child.id);
      const hasUrl = child.resource_url !== null && child.resource_url !== undefined;

      console.log(`Processing: ${child.resource_name}`, {
        parentId,
        hasChildren,
        hasUrl,
        resourceUrl: child.resource_url,
        fatherResource: child.father_resource
      });

      // Skip items that have no URL but shouldn't be parent groups (like "Transaccionales")
      if (!hasUrl && child.resource_name === 'Transaccionales') {
        console.log(`⏭️ Skipping ${child.resource_name} - moving children to parent`);
        // Move children directly to parent (Movimientos)
        const grandChildren = items.filter(item => item.father_resource === child.id);
        for (const grandChild of grandChildren) {
          const grandChildHasAccess = this.isAdmin() ||
                                this.hasPermission(grandChild.resource_url) ||
                                this.hasPermission(grandChild.resource_name);

          if (grandChildHasAccess) {
            const icon = this.iconByOption[grandChild.resource_url] ||
                        this.iconByResourceName[grandChild.resource_name] ||
                        'RECEIPT';

            result.push({
              type: 'default',
              iconPath: icon,
              altText: grandChild.resource_name.toLowerCase(),
              linkText: grandChild.resource_name,
              linkUrl: grandChild.resource_url
            });
          }
        }
        continue;
      }

      // PARENT MENU ITEM (no URL, has children) - Tarjetas, Instituciones, Movimientos, etc.
      if (!hasUrl && hasChildren) {
        const groupChildren = this.buildMenuTree(items, child.id);
        console.log(`Parent ${child.resource_name} has ${groupChildren.length} children`);
        if (child.resource_name === 'Movimientos') {
          console.log('🔍 Movimientos children details:', groupChildren);
        }

        // For admin, always show. For others, show only if there are accessible children
        if (this.isAdmin() || groupChildren.length > 0) {
          const icon = this.iconByOption[child.resource_url] ||
                      this.iconByResourceName[child.resource_name] ||
                      'FOLDER';

          result.push({
            type: 'parent',
            iconPath: icon,
            altText: child.resource_name.toLowerCase(),
            linkText: child.resource_name,
            linkUrl: undefined,
            isOpen: false,
            children: groupChildren
          });
        }
      }
      // SUB-GROUP (no URL, has children) - Transaccionales under Movimientos
      else if (!hasUrl && hasChildren) {
        const groupChildren = this.buildMenuTree(items, child.id);
        console.log(`Sub-group ${child.resource_name} has ${groupChildren.length} children`);

        if (this.isAdmin() || groupChildren.length > 0) {
          const icon = this.iconByOption[child.resource_url] ||
                      this.iconByResourceName[child.resource_name] ||
                      'FOLDER';

          result.push({
            type: 'parent',
            iconPath: icon,
            altText: child.resource_name.toLowerCase(),
            linkText: child.resource_name,
            linkUrl: undefined,
            isOpen: false,
            children: groupChildren
          });
        }
      }
      // LEAF ITEM (has URL, no children) - actual clickable menu item
      else if (hasUrl) {
        const hasAccess = this.isAdmin() ||
                          this.hasPermission(child.resource_url) ||
                          this.hasPermission(child.resource_name);

        console.log(`Leaf item ${child.resource_name}: hasAccess=${hasAccess}`);

        if (hasAccess) {
          const icon = this.iconByOption[child.resource_url] ||
                      this.iconByResourceName[child.resource_name] ||
                      'RECEIPT';

          result.push({
            type: 'default',
            iconPath: icon,
            altText: child.resource_name.toLowerCase(),
            linkText: child.resource_name,
            linkUrl: child.resource_url
          });
        }
      }
    }

    return result;
  }

  createMenu(dataMenu: any[]): void {
    console.log('🎨 MenuSidebar: Creating menu from data:', dataMenu);
    console.log('👑 MenuSidebar: Current user:', this.currentUser);
    console.log('🔑 MenuSidebar: Is admin?', this.isAdmin());

    if (!dataMenu || !Array.isArray(dataMenu)) {
      console.warn('⚠️ MenuSidebar: No menu data provided or invalid format');
      this.items = [];
      return;
    }

    const menuTree = this.buildMenuTree(dataMenu, null);

    console.log('📊 Built menu tree:', menuTree);
    console.log('📊 Menu tree count:', menuTree.length);
    menuTree.forEach((item, index) => {
      console.log(`📊 Item ${index}:`, {
        name: item.linkText,
        type: item.type,
        hasChildren: item.children ? item.children.length : 0,
        altText: item.altText,
        children: item.children ? item.children.map((c: any) => ({ name: c.linkText, url: c.linkUrl })) : null
      });
    });

    const functionalMenu = menuTree.filter((element: any) =>
      element.altText !== 'seguridad' && element.altText !== 'catálogos'
    );
    const securityMenu = menuTree.filter((element: any) =>
      element.altText === 'seguridad' || element.altText === 'catálogos'
    );

    console.log('🔧 Functional menu:', functionalMenu.length, functionalMenu.map(f => f.linkText));
    console.log('🔧 Security menu:', securityMenu.length, securityMenu.map(s => s.linkText));

    const securityItem = securityMenu.length > 0 ? [{
      type: 'section' as const,
      iconPath: 'COG',
      altText: 'Profile Icon',
      linkText: 'Configuración',
      linkUrl: undefined
    }] : [];

    const menuItems: any[] = [...functionalMenu, ...securityItem, ...securityMenu];
    console.log('🔧 Menu items before admin additions:', menuItems.length);

    if (this.isAdmin() ||
        this.hasPermission('/permissions-manager') ||
        this.hasPermission('permissions-management')) {
      menuItems.push({
        type: 'default',
        iconPath: 'KEY',
        altText: 'permissions manager',
        linkText: 'Gestión de Permisos',
        linkUrl: '/permissions-manager'
      });
    }

    if (this.isAdmin() ||
        this.hasPermission('/permission-tester') ||
        this.hasPermission('permission-tester')) {
      menuItems.push({
        type: 'default',
        iconPath: 'TEST',
        altText: 'permission tester',
        linkText: 'Probador de Permisos',
        linkUrl: '/permission-tester'
      });
    }

    if (this.isAdmin()) {
      menuItems.push({
        type: 'default',
        iconPath: 'DATABASE',
        altText: 'database explorer',
        linkText: 'Explorador BD',
        linkUrl: '/database-explorer'
      });
    }

    menuItems.push(
      { type: 'default', iconPath: '', altText: 'Actividades', linkText: 'Actividades', linkUrl: '/activities' },
      { type: 'default', iconPath: 'SIGN_OUT', altText: 'Profile Icon', linkText: 'Cerrar sesión', linkUrl: '/logout' }
    );

    console.log('🔧 Menu items before deduplication:', menuItems.length, menuItems.map(m => m.linkText));

    const uniqueMenuItems = menuItems.filter((item, index, self) => {
      if (!item) return false;
      if (item.type === 'section' || item.type === 'parent') return true;
      if (!('linkUrl' in item)) return false;
      return self.findIndex((t) => t && 'linkUrl' in t && t.linkUrl === item.linkUrl) === index;
    }) as MenuSidebar[];

    console.log('🔧 Final unique menu items:', uniqueMenuItems.length, uniqueMenuItems.map(m => m.linkText));
    console.log('🔧 MenuSidebar: Final menu items:', uniqueMenuItems);
    this.items = uniqueMenuItems;
  }

  onLinkChange(): void {
    this.links.forEach((link: ElementRef) => {});
  }

  toggleChildren(item: MenuSidebar): void {
    if (item.children && item.children.length > 0) {
      item.isOpen = !item.isOpen;
    }
  }

  getType(type: string | undefined): 'parent' | 'child' | 'default' {
    const allowedTypes = ['parent', 'child', 'default'];
    return allowedTypes.includes(type || '') ? (type as 'parent' | 'child' | 'default') : 'default';
  }

  private hasPermission(resourceName: string): boolean {
    if (!resourceName) return false;
    const permissions = this.sharedService.currentPermissions;

    console.log(`🔍 Checking permission for: ${resourceName}`);
    console.log('🔍 Available permissions:', permissions);

    const hasPermission = permissions && permissions.some((permission: any) => {
      const nameMatch = permission.resource_name === resourceName;
      const urlMatch = permission.resource_url === resourceName;
      const hasSelect = permission.select === 1;

      console.log(`🔍 Permission check:`, {
        resourceName,
        permission: {
          resource_name: permission.resource_name,
          resource_url: permission.resource_url,
          select: permission.select
        },
        nameMatch,
        urlMatch,
        hasSelect,
        result: (nameMatch || urlMatch) && hasSelect
      });

      return (nameMatch || urlMatch) && hasSelect;
    });

    console.log(`🔍 Final permission result for ${resourceName}: ${hasPermission}`);
    return hasPermission;
  }

  private isAdmin(): boolean {
    const isAdmin = this.currentUser?.userProfile === 1 ||
           this.currentUser?.profile?.id === 1 ||
           this.currentUser?.role === 'admin' ||
           this.currentUser?.isAdmin === true ||
           this.currentUser?.profile_name === 'Administrador';

    console.log('🔑 Admin check:', {
      userProfile: this.currentUser?.userProfile,
      profileId: this.currentUser?.profile?.id,
      role: this.currentUser?.role,
      isAdmin: this.currentUser?.isAdmin,
      profileName: this.currentUser?.profile_name,
      result: isAdmin
    });

    return isAdmin;
  }
}
