declare namespace recycleContext {
    interface itemSize {
        width: number;
        height: number;
    }
    
    type Component = any;
    type Page = any;
    
    type itemSizeFunc<T> = (item: T, index: number) => void
    
    interface options<T> {
        id: string;
        dataKey: string;
        page: Component | Page;
        itemSize: itemSizeFunc<T> | itemSize;
        useInPage?: boolean;
        root?: Page;
    }
    
    interface position {
        left: number;
        top: number;
        width: number;
        height: number;
    }
    
    interface RecycleContext<T> {
        append(list: T[], callback?: () => void): void
        appendList(list: T[], callback?: () => void): void
        splice(begin: number, deleteCount: number, appendList: T[], callback?: () => void): void;
        updateList(beginIndex: number, list: T[], callback?: () => void): void
        update(beginIndex: number, list: T[], callback?: () => void): void
        destroy(): void
        forceUpdate(callback: () => void, reinitSlot: boolean): void
        getBoundingClientRect(index: number | undefined): position | position[]
        getScrollTop(): number;
        transformRpx(rpx: number, addPxSuffix?: string): number;
        getViewportItems(inViewportPx: number): T[]
        getList(): T[]
    }
}
declare function recycleContext<T>(op: recycleContext.options<T>): recycleContext.RecycleContext<T>

export = recycleContext;