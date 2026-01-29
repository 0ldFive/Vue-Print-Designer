declare module 'dom-to-image-more' {
    export interface Options {
        filter?: (node: Node) => boolean;
        bgcolor?: string;
        width?: number;
        height?: number;
        style?: {};
        quality?: number;
        imagePlaceholder?: string;
        cacheBust?: boolean;
        scale?: number;
    }

    export function toSvg(node: Node, options?: Options): Promise<string>;
    export function toPng(node: Node, options?: Options): Promise<string>;
    export function toJpeg(node: Node, options?: Options): Promise<string>;
    export function toBlob(node: Node, options?: Options): Promise<Blob>;
    export function toPixelData(node: Node, options?: Options): Promise<Uint8ClampedArray>;
    export function toCanvas(node: Node, options?: Options): Promise<HTMLCanvasElement>;
}
