import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TreeModule } from 'primeng/tree';
import { InputTextModule } from 'primeng/inputtext';
import { ButtonModule } from 'primeng/button';
import { BadgeModule } from 'primeng/badge';
import { ScrollPanelModule } from 'primeng/scrollpanel';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TooltipModule } from 'primeng/tooltip';
import { TableInfo } from '@/app/services/admin/database-explorer/database-explorer.service';

interface TreeNode {
  key: string;
  label: string;
  data: TableInfo;
  icon: string;
  type: 'table';
  leaf: true;
  styleClass?: string;
}

@Component({
  selector: 'app-table-browser',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TreeModule,
    InputTextModule,
    ButtonModule,
    BadgeModule,
    ScrollPanelModule,
    ProgressSpinnerModule,
    TooltipModule
  ],
  template: `
    <div class="table-browser h-full flex flex-column surface-card border-round p-2">
      <!-- Search Header -->
      <div class="mb-3">
        <span class="p-input-icon-left w-full">
          <i class="pi pi-search"></i>
          <input 
            pInputText 
            type="text" 
            [(ngModel)]="searchQuery"
            (ngModelChange)="filterTables()"
            placeholder="Buscar tablas..."
            class="w-full">
        </span>
      </div>

      <!-- Stats Summary -->
      <div *ngIf="!searchQuery" class="flex justify-content-between mb-2 text-sm text-color-secondary">
        <span>{{ filteredTables.length }} tablas</span>
        <span>{{ totalRecords | number }} registros</span>
      </div>

      <!-- Loading State -->
      <div *ngIf="loading" class="flex-1 flex align-items-center justify-content-center">
        <p-progressSpinner [style]="{width: '40px', height: '40px'}"></p-progressSpinner>
      </div>

      <!-- Table Tree -->
      <p-scrollPanel *ngIf="!loading" [style]="{width: '100%', height: 'calc(100% - 100px)'}">
        <p-tree
          [value]="treeNodes"
          selectionMode="single"
          [(selection)]="selectedNode"
          (onNodeSelect)="onNodeSelect($event)"
          [style]="{border: 'none', padding: 0}"
          styleClass="p-tree-sm">
          
          <ng-template let-node pTemplate="table">
            <div class="flex align-items-center justify-content-between w-full pr-2">
              <div class="flex align-items-center gap-2 flex-1 min-w-0">
                <i class="pi pi-table text-primary"></i>
                <span 
                  class="text-sm font-medium truncate"
                  [class.text-primary]="selectedTable?.tableName === node.data.tableName"
                  pTooltip="{{ node.data.tableName }}"
                  tooltipPosition="top">
                  {{ node.data.tableName }}
                </span>
              </div>
              
              <div class="flex align-items-center gap-1 flex-shrink-0">
                <p-badge 
                  [value]="formatNumber(node.data.rowCount)" 
                  severity="secondary"
                  styleClass="text-xs">
                </p-badge>
                
                <i *ngIf="node.data.hasRelationships" 
                   class="pi pi-sitemap text-xs text-color-secondary"
                   pTooltip="{{ node.data.relationshipCount }} relaciones">
                </i>
              </div>
            </div>
          </ng-template>
        </p-tree>

        <!-- Empty State -->
        <div *ngIf="treeNodes.length === 0 && searchQuery" class="flex flex-column align-items-center p-3 text-color-secondary">
          <i class="pi pi-search text-2xl mb-2"></i>
          <span class="text-sm">No se encontraron tablas</span>
          <p-button 
            label="Limpiar búsqueda" 
            icon="pi pi-times"
            (onClick)="searchQuery = ''; filterTables()"
            styleClass="p-button-text p-button-sm mt-2">
          </p-button>
        </div>
      </p-scrollPanel>

      <!-- Footer Actions -->
      <div class="mt-auto pt-2 border-top-1 surface-border">
        <p-button 
          icon="pi pi-refresh" 
          label="Actualizar"
          (onClick)="refresh.emit()"
          [loading]="loading"
          styleClass="p-button-text p-button-sm w-full">
        </p-button>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
      height: 100%;
    }

    .table-browser {
      height: 100%;
    }

    :host ::ng-deep .p-tree .p-treenode-content {
      padding: 0.375rem 0.5rem;
      border-radius: 4px;
      margin: 1px 0;
    }

    :host ::ng-deep .p-tree .p-treenode-content.p-highlight {
      background-color: var(--primary-50);
    }

    :host ::ng-deep .p-tree .p-treenode-content:hover {
      background-color: var(--surface-100);
    }

    .truncate {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      max-width: 120px;
    }

    :host ::ng-deep .p-badge {
      min-width: 1.5rem;
      height: 1.5rem;
      line-height: 1.5rem;
      font-size: 0.7rem;
    }

    :host ::ng-deep .p-scrollpanel .p-scrollpanel-wrapper {
      border-radius: 4px;
    }
  `]
})
export class TableBrowserComponent {
  @Input() tables: TableInfo[] = [];
  @Input() selectedTable: TableInfo | null = null;
  @Input() loading = false;
  
  @Output() tableSelect = new EventEmitter<TableInfo>();
  @Output() refresh = new EventEmitter<void>();

  searchQuery = '';
  filteredTables: TableInfo[] = [];
  treeNodes: TreeNode[] = [];
  selectedNode: TreeNode | null = null;

  totalRecords = 0;

  ngOnChanges(): void {
    this.filterTables();
    this.calculateTotals();
  }

  ngOnInit(): void {
    this.filteredTables = [...this.tables];
    this.updateTreeNodes();
    this.calculateTotals();
  }

  filterTables(): void {
    if (!this.searchQuery.trim()) {
      this.filteredTables = [...this.tables];
    } else {
      const query = this.searchQuery.toLowerCase().trim();
      this.filteredTables = this.tables.filter(table => 
        table.tableName.toLowerCase().includes(query) ||
        (table.description && table.description.toLowerCase().includes(query))
      );
    }
    this.updateTreeNodes();
  }

  updateTreeNodes(): void {
    this.treeNodes = this.filteredTables.map(table => ({
      key: table.tableName,
      label: table.tableName,
      data: table,
      icon: 'pi pi-table',
      type: 'table',
      leaf: true,
      styleClass: this.selectedTable?.tableName === table.tableName ? 'p-highlight' : ''
    }));

    // Update selected node
    if (this.selectedTable) {
      this.selectedNode = this.treeNodes.find(n => n.key === this.selectedTable?.tableName) || null;
    }
  }

  onNodeSelect(event: any): void {
    if (event.node?.data) {
      this.tableSelect.emit(event.node.data);
    }
  }

  calculateTotals(): void {
    this.totalRecords = this.tables.reduce((sum, table) => sum + (table.rowCount || 0), 0);
  }

  formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num?.toString() || '0';
  }
}
