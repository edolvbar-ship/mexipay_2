export interface DateRange {
    initial: string;
    final: string;
  }

  export interface CustomTableAction<T> {
    icon?: string,
    label?: string,
    handler: (index: number, item: T) => void;
  }