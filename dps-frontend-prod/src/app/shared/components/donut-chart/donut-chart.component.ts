import { Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { ChartModule } from 'primeng/chart';

@Component({
    selector: 'donut-chart',
    imports: [ChartModule],
    templateUrl: './donut-chart.component.html',
    styleUrls: ['./donut-chart.component.css']
})
export class DonutChartComponent implements OnChanges, OnInit {
  @Input() labels: string[] = ['A', 'B', 'C'];
  @Input() dataValues: number[] = [43, 50, 30];
  @Input() colors: string[] = ['#87CFF9', '#613ECE', '#CFCFCF'];
  @Input() cutout: string = '68%';
  @Input() size: 'small' | 'medium' | 'large' = 'medium';

  percentage: string[] = [];
  data: any = {};
  options: any = {};

  ngOnInit(): void {
    this.initializeChart();
  }

  ngOnChanges(changes: SimpleChanges): void {
    this.initializeChart();
  }

  initializeChart(): void {
    this.data = {
      datasets: [
        {
          data: this.dataValues,
          backgroundColor: this.colors,
          hoverBackgroundColor: this.colors.map(color => color)
        }
      ]
    };

    const total = this.dataValues.reduce((sum, value) => sum + value, 0);
    this.percentage = this.dataValues.map(value => {
      const percent = (value * 100) / total;
      return `${percent.toFixed(2)}%`;
    });

    this.options = {
      cutout: this.cutout,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          backgroundColor: '#ffffff',
          titleColor: '#000000',
          bodyColor: '#000000',
          callbacks: {
            label: (context: any) => {
              const percentage = this.percentage[context.dataIndex] || '';
              return `${percentage}`;
            }
          }
        }
      }
    };
  }

  get chartSize() {
    switch (this.size) {
      case 'small': return { width: '48px', height: '48px' };
      case 'medium': return { width: '72px', height: '72px' };
      case 'large': return { width: '96px', height: '96px' };
      default: return { width: '72px', height: '72px' };
    }
  }
}
