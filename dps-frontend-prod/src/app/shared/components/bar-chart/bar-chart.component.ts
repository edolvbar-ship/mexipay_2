import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { ChartModule } from 'primeng/chart';


@Component({
    selector: 'bar-chart',
    imports: [ChartModule, CommonModule],
    templateUrl: './bar-chart.component.html',
    styleUrls: ['./bar-chart.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class BarChartComponent {
  data: any;
  textColorSecondary = '#000';
  surfaceBorder = '#dddddd';
  @Input() dataApproved: number[] = [65, 59, 80, 81, 56, 55, 40, 65, 59, 80, 81, 56, 55, 40]
  @Input() dataRejected: number[] = [28, 48, 40, 19, 86, 27, 90, 65, 59, 80, 81, 56, 55, 40]
  @Input() labels: string[] = ['']
  @Input() max: number = 100

  ngOnInit() {
    
    this.initializeChart();
    this.getData()

  }

  getData() {
    this.data = {
      labels: this.labels,
      datasets: [
        {
          backgroundColor: '#0C4772',
          borderColor: '#0C4772',
          data: this.dataApproved,
          barThickness: 20
        },
        {
          backgroundColor: '#1F7766',
          borderColor: '#1F7766',
          data: this.dataRejected,
          barThickness: 20
        }
      ]
    };
    return this.data
  }

  initializeChart() {
    this.data = {
      labels: this.labels,
      datasets: [
        {
          backgroundColor: '#0C4772',
          borderColor: '#0C4772',
          data: this.dataApproved,
          barThickness: 20
        },
        {
          backgroundColor: '#1F7766',
          borderColor: '#1F7766',
          data: this.dataRejected,
          barThickness: 20
        }
      ]
    };
  }


  get options() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      aspectRatio: 0.8,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: '#ddd',
          bodyColor: '#000',  
          titleColor: '#000',
          borderWidth: 1, 
          callbacks: {
            label: function (context: any) {
              if (context.parsed.y !== null) {
                return new Intl.NumberFormat('es-MX', {
                  style: 'currency',
                  currency: 'MXN'
                }).format(context.parsed.y);
              }
              return '';
            },

          },
          title: {
            display: false
          }
        },

      },
      scales: {
        x: {
          stacked: false,
          ticks: {
            display: true,
            color: this.textColorSecondary,
            font: {
              weight: 500
            }
          },
          grid: {
            color: this.surfaceBorder,
            drawBorder: false
          },
          offset: true
        },
        y: {
          min: 0,
          max: this.max,
          ticks: {
            color: this.textColorSecondary,
            stepSize: Math.floor(this.max / 10)
          },
          grid: {
            color: this.surfaceBorder,
            drawBorder: false,
            lineWidth: 1,
            borderDash: [5, 5]
          }
        }
      },

      barPercentage: 0.5,
      categoryPercentage: 0.6
    };
  }
}
