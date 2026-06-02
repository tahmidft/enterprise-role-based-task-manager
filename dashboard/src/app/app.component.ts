import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ThemeService } from './shared/theme.service';
import { SidebarService } from './shared/sidebar.service';
import { AppearanceService } from './shared/appearance.service';

@Component({
  standalone: true,
  imports: [RouterOutlet],
  selector: 'app-root',
  template: '<router-outlet />',
  styles: [],
})
export class AppComponent {
  constructor() {
    inject(ThemeService);
    inject(SidebarService);
    inject(AppearanceService);
  }
}
