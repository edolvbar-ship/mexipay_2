import { ChangeDetectorRef, Component, Input, OnChanges, OnInit, SimpleChanges } from '@angular/core';
import { CardContainerComponent } from '../card-container/card-container.component';
import { DonutChartComponent } from '../donut-chart/donut-chart.component';
import { TextTypeComponent } from "../text-type/text-type.component";
import { TextTitleComponent } from "../text-title/text-title.component";
import { CommonModule } from '@angular/common';

@Component({
    selector: 'card-dounut-chart',
    imports: [CardContainerComponent, DonutChartComponent, TextTypeComponent, TextTitleComponent, CommonModule],
    templateUrl: './card-dounut-chart.component.html',
    styleUrl: './card-dounut-chart.component.css'
})
export class CardDounutChartComponent implements OnChanges, OnInit {

  constructor(private cdr: ChangeDetectorRef) { }

  @Input() title: string = '';
  @Input() subTitle: string = ' ';
  @Input() infoChart: { name: string, color: string, count: number }[] = []

  total: number = 0;
  donutColors: string[] = ['#9F9F9F'];
  dataChart: number[] = [];
  labelChart: string[] = [];

  ngOnChanges(changes: SimpleChanges): void {
    this.loadData()
  }

  ngOnInit(): void {
    this.loadData()
  }

  loadData() {
    this.getDataChartInfo()
    this.cdr.detectChanges();
  }

  getDataChartInfo() {
    this.donutColors = this.infoChart.map(item => item.color)
    this.dataChart = this.infoChart.map(item => item.count);
    this.labelChart = this.infoChart.map(item => item.name);
    this.total = this.getTotal()
  }

  getTotal() {
    return this.dataChart.reduce((accumulator, currentValue) => {
      return accumulator + currentValue;
    }, 0);
  }

}