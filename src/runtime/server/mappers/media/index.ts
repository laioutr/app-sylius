export interface SyliusImageInput {
  id: number;
  path: string;
  type: string | null | undefined;
}

export interface MapSyliusImageOptions {
  apiOrigin: string;
  imageFilter: string;
}

export interface MappedSyliusImage {
  type: 'image';
  src: string;
  alt: string;
}

export function mapSyliusImage(image: SyliusImageInput, opts: MapSyliusImageOptions): MappedSyliusImage {
  return {
    type: 'image',
    src: `${opts.apiOrigin}/media/cache/resolve/${opts.imageFilter}/${image.path}`,
    alt: image.type ?? '',
  };
}

export function deriveApiOrigin(apiURL: string): string {
  return new URL(apiURL).origin;
}
