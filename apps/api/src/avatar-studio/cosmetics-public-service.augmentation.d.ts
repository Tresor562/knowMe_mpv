import '../cosmetics/cosmetics-public.service';

declare module '../cosmetics/cosmetics-public.service' {
  interface CosmeticsPublicService {
    snapshot(
      viewerId: string,
      username: string
    ): Promise<{
      visible: boolean;
      reason: string;
      profile: {
        accountId?: string;
        username: string;
        displayName: string;
        avatarUrl: string | null;
      };
      slots: Array<{
        slot: string;
        item: null | {
          id: string;
          key: string;
          version: number;
          name: string;
          description?: string | null;
          rarity: string;
          assetUrl: string;
          previewUrl?: string | null;
          acquisitionPolicy?: string;
        };
      }>;
      rules: Record<string, unknown>;
    }>;
  }
}

export {};
