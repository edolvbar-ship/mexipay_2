import { Component, Input, OnInit } from '@angular/core';
import { ActivityService } from '../services/activity.service';
import {CommonModule, DatePipe} from "@angular/common";
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-activity-list',
  templateUrl: './activity-list.component.html',
  imports: [
    DatePipe,
    CommonModule,
    FormsModule
  ],
  styleUrls: ['./activity-list.component.css']
})
export class ActivityListComponent implements OnInit {
  @Input() isAdmin: boolean = false;
  activities: any[] = [];
  total: number = 0;
  page: number = 1;
  limit: number = 50;
  totalPages: number = 0;
  loading: boolean = false;

  // Filter properties
  filters = {
    search: '',
    action: '',
    statusCode: '',
    method: '',
    startDate: '',
    endDate: ''
  };

  // Filter options
  actionTypes: string[] = [];
  statusCodes: number[] = [200, 201, 400, 401, 403, 404, 500];
  methods: string[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

  constructor(private activityService: ActivityService) {}

  ngOnInit(): void {
    this.fetchActivities();
    this.loadFilterOptions();
  }

  loadFilterOptions(): void {
    // In a real app, you might fetch these from the backend
    this.actionTypes = [
      'LOGIN', 'LOGOUT', 'CREATE_USER', 'UPDATE_USER', 'DELETE_USER',
      'CREATE_MERCHANT', 'UPDATE_MERCHANT', 'DELETE_MERCHANT',
      'CREATE_TRANSACTION', 'UPDATE_TRANSACTION', 'VIEW_REPORTS',
      'EXPORT_DATA', 'IMPORT_DATA', 'SYSTEM_CONFIG'
    ];
  }

  fetchActivities(): void {
    this.loading = true;
    const serviceCall = this.isAdmin
      ? this.activityService.getAllActivities(this.page, this.limit, undefined, this.filters.action)
      : this.activityService.getMyActivities(this.limit, (this.page - 1) * this.limit, this.filters);

    serviceCall.subscribe({
      next: (data) => {
        this.activities = data.data;
        this.total = data.total;
        this.totalPages = Math.ceil(this.total / this.limit);
        this.loading = false;
      },
      error: (error) => {
        console.error('Error:', error);
        this.loading = false;
      }
    });
  }

  applyFilters(): void {
    this.page = 1; // Reset to first page when applying filters
    this.fetchActivities();
  }

  clearFilters(): void {
    this.filters = {
      search: '',
      action: '',
      statusCode: '',
      method: '',
      startDate: '',
      endDate: ''
    };
    this.page = 1;
    this.fetchActivities();
  }

  previousPage(): void {
    if (this.page > 1) {
      this.page--;
      this.fetchActivities();
    }
  }

  nextPage(): void {
    if (this.page < this.totalPages) {
      this.page++;
      this.fetchActivities();
    }
  }

  getStatusClass(statusCode: number): string {
    if (statusCode >= 200 && statusCode < 300) {
      return 'status-success';
    } else if (statusCode >= 300 && statusCode < 400) {
      return 'status-redirect';
    } else if (statusCode >= 400 && statusCode < 500) {
      return 'status-client-error';
    } else if (statusCode >= 500) {
      return 'status-server-error';
    }
    return 'status-unknown';
  }
}
