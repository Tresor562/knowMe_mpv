import '../cosmetics/cosmetics-public.service';

declare module '../cosmetics/cosmetics-public.service' {
  interface CosmeticsPublicService {
    snapshot(viewerId: string, username: string): Promise<any>;
  }
}

export {};
