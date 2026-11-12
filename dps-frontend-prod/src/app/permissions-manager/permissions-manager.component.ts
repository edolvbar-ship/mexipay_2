// File: src/app/admin/permissions-management/permissions-management.component.ts (full, with MatTable, form, API calls)
import { Component, OnInit, ViewEncapsulation } from '@angular/core';
import { TableModule } from 'primeng/table';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { CheckboxModule } from 'primeng/checkbox';
import { CardModule } from 'primeng/card';
import { ChipModule } from 'primeng/chip';
import { IconFieldModule } from 'primeng/iconfield';
import { InputIconModule } from 'primeng/inputicon';
import { PaginatorModule } from 'primeng/paginator';
import { MultiSelectModule } from 'primeng/multiselect';
import { ToastModule } from 'primeng/toast';
import { TooltipModule } from 'primeng/tooltip';
import { MessageService } from 'primeng/api';
import { RouterModule } from '@angular/router';

@Component({
    selector: 'app-permissions-management',
    templateUrl: './permissions-manager.component.html',
    styleUrls: ['./permissions-manager.component.css'],
    standalone: true,
    encapsulation: ViewEncapsulation.None,
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        RouterModule,
        TableModule,
        ButtonModule,
        InputTextModule,
        TextareaModule,
        CheckboxModule,
        CardModule,
        ChipModule,
        IconFieldModule,
        InputIconModule,
        PaginatorModule,
        MultiSelectModule,
        ToastModule,
        TooltipModule
    ],
    providers: [MessageService]
})
export class PermissionsManagementComponent implements OnInit {
  // Table data
  dataSource: any[] = [];
  profilesDataSource: any[] = [];
  permissionsDataSource: any[] = [];
  resourcesDataSource: any[] = []; // New grouped by resources

  // HTTP Methods for dropdown
  httpMethods = [
    { label: 'GET', value: 'GET' },
    { label: 'POST', value: 'POST' },
    { label: 'PUT', value: 'PUT' },
    { label: 'DELETE', value: 'DELETE' },
    { label: 'PATCH', value: 'PATCH' },
    { label: 'HEAD', value: 'HEAD' },
    { label: 'OPTIONS', value: 'OPTIONS' }
  ];

  // Form and selection
  form: FormGroup;
  resourceForm: FormGroup;
  selected: any = null;
  selectedProfile: any = null;
  selectedPermissions: any[] = [];
  generatedMethods: string[] = [];
  selectedResource: any = null;

  // View mode
  currentView: 'matrix' | 'profiles' | 'dashboard' | 'resources' = 'matrix';

  // Pagination
  first: number = 0;
  rows: number = 10;

  // Loading states
  loading: boolean = false;

  // Search functionality
  searchTerm: string = '';
  filteredDataSource: any[] = [];
  private searchSubject = new Subject<string>();

  constructor(private http: HttpClient, private fb: FormBuilder, private messageService: MessageService) {
    this.form = fb.group({
      id_profile: [[], Validators.required], // MultiSelect expects array, required
      id_resource: [[], Validators.required], // MultiSelect expects array, required
      allowed_methods: [''], // Will be auto-generated
      create: [0],
      edit: [0],
      delete: [0],
      select: [0]
    });

    this.resourceForm = fb.group({
      resource_name: ['', [Validators.required, Validators.minLength(3)]],
      resource_url: ['', [Validators.required, Validators.pattern(/^\/[a-zA-Z0-9/_-]+$/)]],
      description: ['']
    });
  }

  ngOnInit() {
    this.loadResources();
    this.loadAllResources();
    this.loadProfiles();
    this.loadPermissionsDashboard();

    // Setup search with debouncing
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(searchTerm => {
      this.applyFilter(searchTerm);
    });

    // Listen to form changes to update HTTP methods
    this.form.get('create')?.valueChanges.subscribe(() => this.updateHttpMethods());
    this.form.get('edit')?.valueChanges.subscribe(() => this.updateHttpMethods());
    this.form.get('delete')?.valueChanges.subscribe(() => this.updateHttpMethods());
    this.form.get('select')?.valueChanges.subscribe(() => this.updateHttpMethods());
  }

  updateHttpMethods(): void {
    const methods: string[] = [];

    // Handle both boolean (true/false) and numeric (1/0) values
    const createValue = this.form.get('create')?.value;
    const editValue = this.form.get('edit')?.value;
    const deleteValue = this.form.get('delete')?.value;
    const selectValue = this.form.get('select')?.value;

    if (createValue === true || createValue === 1) methods.push('POST');
    if (editValue === true || editValue === 1) methods.push('PUT', 'PATCH');
    if (deleteValue === true || deleteValue === 1) methods.push('DELETE');
    if (selectValue === true || selectValue === 1) methods.push('GET');

    this.generatedMethods = [...new Set(methods)]; // Remove duplicates
    this.form.get('allowed_methods')?.setValue(this.generatedMethods.join(','));
  }

  // Helper method to generate HTTP methods from permission data
  generateMethodsFromPermissions(item: any): string {
    const methods: string[] = [];
    if (item.create) methods.push('POST');
    if (item.edit) methods.push('PUT', 'PATCH');
    if (item.delete) methods.push('DELETE');
    if (item.select) methods.push('GET');
    return methods.join(',');
  }

  allResources: any[] = []; // All resources from resources table

  loadAllResources() {
    this.loading = true;
    this.http.get('/api/profiles/resources/all').subscribe({
      next: (data: any) => {
        let resourcesData = [];
        if (data && data.data && Array.isArray(data.data)) {
          resourcesData = data.data;
        } else if (data && Array.isArray(data)) {
          resourcesData = data;
        }
        // Add resourceLabelWithRoute for dropdown display
        this.allResources = resourcesData.map((item: any) => ({
          ...item,
          resourceLabelWithRoute: `${item.resource_name} (${item.resource_url || 'no URL'})`
        })).sort((a: any, b: any) => {
          const nameA = a.resource_name?.toLowerCase() || '';
          const nameB = b.resource_name?.toLowerCase() || '';
          return nameA.localeCompare(nameB);
        });
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading all resources:', error);
        this.allResources = [];
        this.loading = false;
      }
    });
  }

  loadResources() {
    this.loading = true;
    // For admin users, load ALL permissions matrix instead of filtered resources
    this.http.get('/api/profiles/matrix').subscribe({
      next: (data: any) => {
        console.log('🔍 DEBUG: Full permissions matrix received:', data);
        console.log('🔍 DEBUG: Response structure:', JSON.stringify(data, null, 2));

        // Check response structure and handle different formats
        let permissionsData = [];

        if (data && data.data && Array.isArray(data.data)) {
          permissionsData = data.data;
        } else if (data && Array.isArray(data)) {
          permissionsData = data;
        } else if (data && data.status === 'ok' && Array.isArray(data.data)) {
          permissionsData = data.data;
        } else if (data && data.data === null) {
          // Handle case where data is null but status is 200
          console.warn('⚠️ API returned null data with status 200 - no permissions found');
          permissionsData = [];
        } else {
          console.error('❌ Unexpected response structure:', data);
          this.messageService.add({severity: 'error', summary: 'Error', detail: 'Invalid response format from server'});
          this.loading = false;
          return;
        }

        if (permissionsData.length === 0) {
          console.warn('⚠️ No permissions data received');
          this.dataSource = [];
          this.permissionsDataSource = [];
          this.filteredDataSource = [];
          this.loading = false;
          return;
        }

        // Use the raw data directly - no transformation needed
        const transformedData = permissionsData.map((item: any) => ({
          ...item,
          allowed_methods: this.generateMethodsFromPermissions(item), // Generate from actual permissions
          resourceLabelWithRoute: `${item.resource_name} (${item.resource_url || 'no URL'})`
        }));

        // Set data sources
        this.permissionsDataSource = transformedData; // 159 permissions
        this.filteredDataSource = transformedData;     // Table uses this

        // Group by resources for the resource view
        this.groupPermissionsByResource();
        const uniqueResources = new Map();
        transformedData.forEach((item: any) => {
          if (!uniqueResources.has(item.id_resource)) {
            uniqueResources.set(item.id_resource, {
              id_resource: item.id_resource,
              resource_name: item.resource_name,
              resource_url: item.resource_url,
              resourceLabelWithRoute: item.resourceLabelWithRoute
            });
          }
        });

        // Convert to array for dropdown (form uses this)
        this.dataSource = Array.from(uniqueResources.values()).sort((a: any, b: any) => {
          const nameA = a.resource_name?.toLowerCase() || '';
          const nameB = b.resource_name?.toLowerCase() || '';
          return nameA.localeCompare(nameB);
        });

        console.log('🔍 DEBUG: Resources for dropdown:', this.dataSource);
        console.log('🔍 DEBUG: Permissions for table:', this.permissionsDataSource);

        // Initialize filtered data source
        this.loading = false;
      },
      error: (error) => {
        console.error('❌ Error loading permissions:', error);
        this.messageService.add({severity: 'error', summary: 'Error', detail: 'Failed to load permissions: ' + (error.message || error.statusText || 'Unknown error')});
        this.loading = false;
      }
    });
  }

  loadProfiles() {
    this.loading = true;
    this.http.get('/api/profiles/with-count').subscribe({
      next: (data: any) => {
        // Handle different response structures
        if (data && data.data && Array.isArray(data.data)) {
          this.profilesDataSource = data.data;
        } else if (data && Array.isArray(data)) {
          this.profilesDataSource = data;
        } else {
          console.warn('⚠️ Unexpected profiles response structure:', data);
          this.profilesDataSource = [];
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('❌ Error loading profiles:', error);
        this.messageService.add({severity: 'error', summary: 'Error', detail: 'Failed to load profiles: ' + (error.message || error.statusText || 'Unknown error')});
        this.profilesDataSource = [];
        this.loading = false;
      }
    });
  }

  loadPermissionsDashboard() {
    this.loading = true;
    this.http.get('/api/profiles/dashboard/view').subscribe({
      next: (data: any) => {
        // Handle different response structures
        if (data && data.data && Array.isArray(data.data)) {
          this.resourcesDataSource = data.data;
        } else if (data && Array.isArray(data)) {
          this.resourcesDataSource = data;
        } else {
          console.warn('⚠️ Unexpected dashboard response structure:', data);
          this.resourcesDataSource = [];
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('❌ Error loading dashboard:', error);
        this.messageService.add({severity: 'error', summary: 'Error', detail: 'Failed to load dashboard: ' + (error.message || error.statusText || 'Unknown error')});
        this.resourcesDataSource = [];
        this.loading = false;
      }
    });
  }

  // Dashboard helper methods
  getTotalProfilesCount(): number {
    const allProfiles = new Set();
    this.permissionsDataSource.forEach((permission: any) => {
      if (permission.id_profile) {
        allProfiles.add(permission.id_profile);
      }
    });
    return allProfiles.size;
  }

  getTotalPermissionsCount(): number {
    let total = 0;
    this.permissionsDataSource.forEach((permission: any) => {
      const permissions = [permission.create, permission.edit, permission.delete, permission.select].filter(p => p === 1).length;
      total += permissions;
    });
    return total;
  }

  copyToClipboard(text: string) {
    navigator.clipboard.writeText(text).then(() => {
      this.messageService.add({
        severity: 'success',
        summary: 'Copied!',
        detail: 'URL copied to clipboard',
        life: 2000
      });
    }).catch(() => {
      this.messageService.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Failed to copy URL'
      });
    });
  }

  refreshAllData() {
    this.messageService.add({
      severity: 'info',
      summary: 'Refreshing',
      detail: 'Loading fresh data...',
      life: 1500
    });

    this.loadResources();
    this.loadProfiles();
    this.loadPermissionsDashboard();
  }

  setView(view: 'matrix' | 'profiles' | 'dashboard' | 'resources') {
    this.currentView = view;
  }

  // Group permissions by resource
  groupPermissionsByResource(): void {
    const grouped = new Map();

    this.dataSource.forEach((item: any) => {
      const resourceKey = item.resource_name;

      if (!grouped.has(resourceKey)) {
        grouped.set(resourceKey, {
          resource_name: item.resource_name,
          resource_url: item.resource_url,
          id_resource: item.id_resource,
          profiles_with_access: [] // HTML expects this field name
        });
      }

      grouped.get(resourceKey).profiles_with_access.push({
        id_profile: item.id_profile,
        profile_name: item.profile_name,
        create: item.create,
        edit: item.edit,
        delete: item.delete,
        select: item.select
      });
    });

    this.resourcesDataSource = Array.from(grouped.values());
  }

  toggleProfilePermission(profile: any, resource: any, permissionType: string) {
    const existingPermission = this.dataSource.find(
      (item: any) => item.id_profile === profile.id_profile && item.id_resource === resource.id_resource
    );

    if (existingPermission) {
      const updatedPermission = { ...existingPermission };
      updatedPermission[permissionType] = updatedPermission[permissionType] ? 0 : 1;

      this.http.put(`/api/profiles/resources/${existingPermission.id}`, updatedPermission).subscribe(() => {
        this.loadResources();
        this.loadProfiles();
        this.loadPermissionsDashboard();
        this.messageService.add({severity: 'success', summary: 'Success', detail: 'Permission updated'});
      });
    } else {
      const newPermission = {
        id_profile: profile.id_profile,
        id_resource: resource.id_resource,
        allowed_methods: 'GET,POST',
        create: permissionType === 'create' ? 1 : 0,
        edit: permissionType === 'edit' ? 1 : 0,
        delete: permissionType === 'delete' ? 1 : 0,
        select: permissionType === 'select' ? 1 : 0
      };

      this.http.post('/api/profiles/resources', newPermission).subscribe(() => {
        this.loadResources();
        this.loadProfiles();
        this.loadPermissionsDashboard();
        this.messageService.add({severity: 'success', summary: 'Success', detail: 'Permission created'});
      });
    }
  }

  removePermissionFromProfile(profileId: number, resourceId: number) {
    const permission = this.dataSource.find(
      (item: any) => item.id_profile === profileId && item.id_resource === resourceId
    );

    if (permission) {
      this.http.delete(`/api/profiles/resources/${permission.id}`).subscribe(() => {
        this.loadResources();
        this.loadProfiles();
        this.loadPermissionsDashboard();
        this.messageService.add({severity: 'success', summary: 'Success', detail: 'Permission removed'});
      });
    }
  }

  togglePermissionSelection(permission: any) {
    const index = this.selectedPermissions.findIndex(p => p.id === permission.id);
    if (index > -1) {
      this.selectedPermissions.splice(index, 1);
    } else {
      this.selectedPermissions.push(permission);
    }
  }

  bulkDelete() {
    if (this.selectedPermissions.length === 0) {
      this.messageService.add({severity: 'warn', summary: 'Warning', detail: 'No permissions selected'});
      return;
    }

    const deletePromises = this.selectedPermissions.map((item: any) =>
      this.http.delete(`/api/profiles/resources/${item.id}`)
    );

    Promise.all(deletePromises).then(() => {
      const deletedCount = this.selectedPermissions.length;
      this.selectedPermissions = [];
      this.loadResources();
      this.loadProfiles();
      this.loadPermissionsDashboard();
      this.messageService.add({severity: 'success', summary: 'Success', detail: `${deletedCount} permissions deleted`});
    }).catch((error) => {
      console.error('❌ Bulk delete failed:', error);
      this.messageService.add({severity: 'error', summary: 'Error', detail: 'Failed to delete some permissions'});
    });
  }

  createOrUpdate() {
    if (this.form.invalid) {
      this.messageService.add({severity: 'warn', summary: 'Warning', detail: 'Please fill all required fields'});
      return;
    }

    const payload = this.form.value;

    // Handle multi-select arrays - extract single values if needed
    const processedPayload = {
      id_profile: Array.isArray(payload.id_profile) ? payload.id_profile[0] : payload.id_profile,
      id_resource: Array.isArray(payload.id_resource) ? payload.id_resource[0] : payload.id_resource,
      allowed_methods: payload.allowed_methods || '',
      create: payload.create ? 1 : 0,
      edit: payload.edit ? 1 : 0,
      delete: payload.delete ? 1 : 0,
      select: payload.select ? 1 : 0
    };

    // Validate required fields
    if (!processedPayload.id_profile || !processedPayload.id_resource) {
      this.messageService.add({severity: 'warn', summary: 'Warning', detail: 'Please select both profile and resource'});
      return;
    }

    if (this.selected) {
      this.http.put(`/api/profiles/resources/${this.selected.id}`, processedPayload).subscribe({
        next: () => {
          this.loadResources();
          this.resetForm();
          this.messageService.add({severity: 'success', summary: 'Success', detail: 'Permission updated'});
        },
        error: (error) => {
          console.error('❌ Failed to update permission:', error);
          this.messageService.add({severity: 'error', summary: 'Error', detail: 'Failed to update permission: ' + (error.message || error.statusText || 'Unknown error')});
        }
      });
    } else {
      this.http.post('/api/profiles/resources', processedPayload).subscribe({
        next: () => {
          this.loadResources();
          this.resetForm();
          this.messageService.add({severity: 'success', summary: 'Success', detail: 'Permission created'});
        },
        error: (error) => {
          console.error('❌ Failed to create permission:', error);
          this.messageService.add({severity: 'error', summary: 'Error', detail: 'Failed to create permission: ' + (error.message || error.statusText || 'Unknown error')});
        }
      });
    }
  }

  edit(resource: any) {
    this.selected = resource;

    this.form.patchValue({
      id_profile: [resource.id_profile], // MultiSelect needs array
      id_resource: [resource.id_resource], // MultiSelect needs array
      allowed_methods: resource.allowed_methods || '',
      create: Boolean(resource.create),
      edit: Boolean(resource.edit),
      delete: Boolean(resource.delete),
      select: Boolean(resource.select)
    });

    // Update generated methods display
    this.updateHttpMethods();
  }

  delete(id: number) {
    if (confirm('Confirm delete?')) {
      this.http.delete(`/api/profiles/resources/${id}`).subscribe({
        next: () => {
          this.loadResources();
          this.messageService.add({severity: 'success', summary: 'Success', detail: 'Permission deleted'});
        },
        error: (error) => {
          console.error('❌ Failed to delete permission:', error);
          this.messageService.add({severity: 'error', summary: 'Error', detail: 'Failed to delete permission: ' + (error.message || error.statusText || 'Unknown error')});
        }
      });
    }
  }

  resetForm() {
    this.form.reset({
      id_profile: [], // Reset to empty array for MultiSelect
      id_resource: [], // Reset to empty array for MultiSelect
      allowed_methods: '',
      create: 0,
      edit: 0,
      delete: 0,
      select: 0
    });
    this.selected = null;
    this.generatedMethods = [];
  }

  getPermissionIcon(permissionType: string, value: number): string {
    if (permissionType === 'create') return value ? '✓' : '✗';
    if (permissionType === 'edit') return value ? '✓' : '✗';
    if (permissionType === 'delete') return value ? '✓' : '✗';
    if (permissionType === 'select') return value ? '✓' : '✗';
    return '';
  }

  getPermissionClass(permissionType: string, value: number): string {
    if (!value) return 'text-red-600';
    return 'text-green-600';
  }

  viewProfilePermissions(profile: any) {
    this.selectedProfile = profile;
  }

  getProfilePermissions(profileId: number): any[] {
    return this.dataSource.filter((item: any) => item.id_profile === profileId);
  }

  // New methods for resource view
  editRoleResourcePermission(role: any, resource: any) {
    // Find the actual permission record
    const permission = this.dataSource.find(
      (item: any) => item.id_profile === role.id_profile && item.resource_name === resource.resource_name
    );

    if (permission) {
      this.selected = permission;
      this.form.patchValue({
        id_profile: [permission.id_profile], // MultiSelect needs array
        id_resource: [permission.id_resource], // MultiSelect needs array
        create: permission.create === 1,
        edit: permission.edit === 1,
        delete: permission.delete === 1,
        select: permission.select === 1
      });
    }
  }

  deleteRoleResourcePermission(role: any, resource: any) {
    // Find the actual permission record
    const permission = this.dataSource.find(
      (item: any) => item.id_profile === role.id_profile && item.resource_name === resource.resource_name
    );

    if (permission) {
      this.delete(permission.id);
    }
  }

  isAllSelected(): boolean {
    return this.permissionsDataSource.length > 0 && this.selectedPermissions.length === this.permissionsDataSource.length;
  }

  toggleAllSelection() {
    if (this.isAllSelected()) {
      this.selectedPermissions = [];
    } else {
      this.selectedPermissions = [...this.permissionsDataSource]; // Use permissions, not resources
    }
  }

  isPermissionSelected(permission: any): boolean {
    return this.selectedPermissions.some(p => p.id === permission.id);
  }

  // Helper method to display resource name with route label
  resourceLabelWithRoute(resource: any): string {
    if (!resource) {
      return '';
    }

    const resourceName = resource.resource_name || `Resource ${resource.id_resource || 'Unknown'}`;
    const resourceUrl = resource.resource_url || '';

    return resourceUrl ? `${resourceName} (${resourceUrl})` : resourceName;
  }

  // Search functionality methods
  onSearchChange(event: any): void {
    const searchTerm = event.target?.value || '';
    this.searchSubject.next(searchTerm);
  }

  applyFilter(searchTerm: string): void {
    this.searchTerm = searchTerm;

    if (!searchTerm || searchTerm.trim() === '') {
      this.filteredDataSource = [...this.dataSource];
      return;
    }

    const searchLower = searchTerm.toLowerCase().trim();

    this.filteredDataSource = this.dataSource.filter((item: any) => {
      // Search in multiple fields
      return (
        (item.profile_name && item.profile_name.toLowerCase().includes(searchLower)) ||
        (item.resource_name && item.resource_name.toLowerCase().includes(searchLower)) ||
        (item.resource_url && item.resource_url.toLowerCase().includes(searchLower)) ||
        (item.allowed_methods && item.allowed_methods.toLowerCase().includes(searchLower))
      );
    });
  }

  clearSearch(): void {
    this.searchTerm = '';
    this.filteredDataSource = [...this.dataSource];
  }

  // Resource Management Methods

  // Create or update a resource in the resources table
  createOrUpdateResource() {
    if (this.resourceForm.invalid) {
      this.messageService.add({severity: 'warn', summary: 'Warning', detail: 'Please fill all required fields correctly'});
      return;
    }

    const payload = this.resourceForm.value;

    if (this.selectedResource) {
      // Update existing resource
      this.http.put(`/api/profiles/resources/manage/${this.selectedResource.id}`, payload).subscribe({
        next: () => {
          this.loadAllResources();
          this.loadResources();
          this.resetResourceForm();
          this.messageService.add({severity: 'success', summary: 'Success', detail: 'Resource updated successfully'});
        },
        error: (error) => {
          console.error('Failed to update resource:', error);
          this.messageService.add({severity: 'error', summary: 'Error', detail: 'Failed to update resource: ' + (error.error?.message || error.message || 'Unknown error')});
        }
      });
    } else {
      // Create new resource
      this.http.post('/api/profiles/resources/manage', payload).subscribe({
        next: () => {
          this.loadAllResources();
          this.loadResources();
          this.resetResourceForm();
          this.messageService.add({severity: 'success', summary: 'Success', detail: 'Resource created successfully'});
        },
        error: (error) => {
          console.error('Failed to create resource:', error);
          this.messageService.add({severity: 'error', summary: 'Error', detail: 'Failed to create resource: ' + (error.error?.message || error.message || 'Unknown error')});
        }
      });
    }
  }

  // Edit a resource - populate the form
  editResource(resource: any) {
    this.selectedResource = resource;
    this.resourceForm.patchValue({
      resource_name: resource.resource_name,
      resource_url: resource.resource_url,
      description: resource.description || ''
    });
  }

  // Delete a resource
  deleteResource(resource: any) {
    if (confirm(`Are you sure you want to delete the resource "${resource.resource_name}"?\n\nThis will also delete all associated permissions.`)) {
      this.http.delete(`/api/profiles/resources/manage/${resource.id}`).subscribe({
        next: () => {
          this.loadAllResources();
          this.loadResources();
          this.messageService.add({severity: 'success', summary: 'Success', detail: 'Resource deleted successfully'});
        },
        error: (error) => {
          console.error('Failed to delete resource:', error);
          this.messageService.add({severity: 'error', summary: 'Error', detail: 'Failed to delete resource: ' + (error.error?.message || error.message || 'Unknown error')});
        }
      });
    }
  }

  // Reset the resource form
  resetResourceForm() {
    this.resourceForm.reset({
      resource_name: '',
      resource_url: '',
      description: ''
    });
    this.selectedResource = null;
  }

  // Legacy method - kept for compatibility but now redirects to proper form
  addNewResource() {
    this.setView('resources');
    this.messageService.add({
      severity: 'info',
      summary: 'Resource Registration',
      detail: 'Please use the Resource Management view to register new resources'
    });
  }
}
