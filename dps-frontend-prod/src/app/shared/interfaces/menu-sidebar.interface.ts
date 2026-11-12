export interface MenuSidebar {
    iconPath?: string;
    altText?: string;
    linkText?: string;
    linkUrl?: string | undefined; 
    children?: MenuSidebar[];
    isOpen?: boolean;
    type?: 'parent' | 'child' | 'default' | 'section'
}

export type ParentMenuItem = MenuSidebar & { type: 'parent'; children: MenuSidebar[]; isOpen: boolean };
export type SectionMenuItem = MenuSidebar & { type: 'section' };
export type ChildMenuItem = MenuSidebar & { type: 'child' };
export type DefaultMenuItem = MenuSidebar & { type: 'default' };

export type AnyMenuItem = ParentMenuItem | SectionMenuItem | ChildMenuItem | DefaultMenuItem;
