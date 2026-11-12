import { Component, Input, OnInit } from '@angular/core';
import { TextTitleComponent } from '../text-title/text-title.component';
import { NavigationEnd, Router, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { PrimeIcons } from 'primeng/api'

@Component({
    selector: 'sidebar-element',
    imports: [RouterLinkActive, CommonModule],
    templateUrl: './sidebar-element.component.html',
    styleUrl: './sidebar-element.component.css'
})
export class SidebarElementComponent implements OnInit{

  constructor(private router: Router) {}

  @Input() linkIcon: string = '';
  @Input() altText: string = '';
  @Input() linkText: string = '';
  @Input() linkUrl: string = '';

  isActive = false;

  ngOnInit(): void {
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.isActive = this.router.url === this.linkUrl;
      }
    });
  }

  get iconPath(): string {
    const formattedIcon = this.linkIcon.toUpperCase().replace(' ', '_');
    return (PrimeIcons[formattedIcon as keyof typeof PrimeIcons] || 'pi pi-plus-circle') as string;
  }

}
