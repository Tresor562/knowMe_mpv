import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentPlatform, PaymentProvider } from './payment-provider.types';

type ProductSeed = {
  key: string;
  name: string;
  description: string;
  kind: 'SUBSCRIPTION' | 'KNOWCOINS' | 'ENTITLEMENT';
  highlighted?: boolean;
  fulfillmentType: 'BILLING_PLAN' | 'KNOWCOINS' | 'ENTITLEMENT';
  fulfillmentReference: string;
  fulfillmentQuantity: number;
  requiresVerification?: boolean;
  requiresManualReview?: boolean;
  metadata?: Prisma.InputJsonValue;
};

type PriceSeed = {
  productKey: string;
  provider: PaymentProvider;
  platform: PaymentPlatform;
  countryCode?: string;
  currency: string;
  unitAmount: number;
  externalProductId?: string;
  active?: boolean;
};

const PRODUCT_SEEDS: ProductSeed[] = [
  {
    key: 'premium_monthly',
    name: 'KnowMe Premium',
    description: 'Abonnement mensuel KnowMe Premium.',
    kind: 'SUBSCRIPTION',
    highlighted: true,
    fulfillmentType: 'BILLING_PLAN',
    fulfillmentReference: 'premium_monthly',
    fulfillmentQuantity: 1,
    metadata: { interval: 'MONTH', intervalCount: 1 }
  },
  {
    key: 'verified_monthly',
    name: 'Badge Certifié',
    description: 'Abonnement mensuel au badge Certifié, soumis à vérification.',
    kind: 'SUBSCRIPTION',
    fulfillmentType: 'BILLING_PLAN',
    fulfillmentReference: 'verified_monthly',
    fulfillmentQuantity: 1,
    requiresVerification: true,
    requiresManualReview: true,
    metadata: { interval: 'MONTH', intervalCount: 1 }
  },
  ...[100, 250, 500, 1000, 5000].map((quantity) => ({
    key: `knowcoins_${quantity}`,
    name: `${quantity} KnowCoins`,
    description: `Pack de ${quantity} KnowCoins crédité après vérification du paiement.`,
    kind: 'KNOWCOINS' as const,
    fulfillmentType: 'KNOWCOINS' as const,
    fulfillmentReference: 'knowcoins',
    fulfillmentQuantity: quantity
  }))
];

const WEB_PRICE_SEEDS: PriceSeed[] = [
  {
    productKey: 'premium_monthly',
    provider: 'FLUTTERWAVE',
    platform: 'WEB',
    currency: 'USD',
    unitAmount: 2000
  },
  {
    productKey: 'premium_monthly',
    provider: 'CINETPAY',
    platform: 'WEB',
    currency: 'USD',
    unitAmount: 2000
  },
  {
    productKey: 'verified_monthly',
    provider: 'FLUTTERWAVE',
    platform: 'WEB',
    currency: 'USD',
    unitAmount: 2500
  },
  {
    productKey: 'verified_monthly',
    provider: 'CINETPAY',
    platform: 'WEB',
    currency: 'USD',
    unitAmount: 2500
  },
  { productKey: 'knowcoins_100', provider: 'FLUTTERWAVE', platform: 'WEB', currency: 'EUR', unitAmount: 173 },
  { productKey: 'knowcoins_250', provider: 'FLUTTERWAVE', platform: 'WEB', currency: 'EUR', unitAmount: 433 },
  { productKey: 'knowcoins_500', provider: 'FLUTTERWAVE', platform: 'WEB', currency: 'EUR', unitAmount: 865 },
  { productKey: 'knowcoins_1000', provider: 'FLUTTERWAVE', platform: 'WEB', currency: 'EUR', unitAmount: 1730 },
  { productKey: 'knowcoins_5000', provider: 'FLUTTERWAVE', platform: 'WEB', currency: 'EUR', unitAmount: 8650 }
];

@Injectable()
export class CommerceCatalogService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService
  ) {}

  async onModuleInit() {
    for (const seed of PRODUCT_SEEDS) {
      await this.prisma.commerceProduct.upsert({
        where: { key: seed.key },
        create: {
          ...seed,
          active: true,
          highlighted: seed.highlighted ?? false,
          requiresVerification: seed.requiresVerification ?? false,
          requiresManualReview: seed.requiresManualReview ?? false
        },
        update: {
          name: seed.name,
          description: seed.description,
          kind: seed.kind,
          active: true,
          highlighted: seed.highlighted ?? false,
          fulfillmentType: seed.fulfillmentType,
          fulfillmentReference: seed.fulfillmentReference,
          fulfillmentQuantity: seed.fulfillmentQuantity,
          requiresVerification: seed.requiresVerification ?? false,
          requiresManualReview: seed.requiresManualReview ?? false,
          metadata: seed.metadata
        }
      });
    }

    const configuredStorePrices = this.storePriceSeeds();
    for (const seed of [...WEB_PRICE_SEEDS, ...configuredStorePrices]) {
      const product = await this.prisma.commerceProduct.findUniqueOrThrow({
        where: { key: seed.productKey },
        select: { id: true }
      });
      const existing = await this.prisma.commercePrice.findFirst({
        where: {
          productId: product.id,
          provider: seed.provider,
          platform: seed.platform,
          countryCode: seed.countryCode ?? null,
          currency: seed.currency,
          externalProductId: seed.externalProductId ?? null
        }
      });
      if (existing) {
        await this.prisma.commercePrice.update({
          where: { id: existing.id },
          data: {
            unitAmount: seed.unitAmount,
            active: seed.active ?? true
          }
        });
      } else {
        await this.prisma.commercePrice.create({
          data: {
            productId: product.id,
            provider: seed.provider,
            platform: seed.platform,
            countryCode: seed.countryCode ?? null,
            currency: seed.currency,
            unitAmount: seed.unitAmount,
            externalProductId: seed.externalProductId ?? null,
            active: seed.active ?? true
          }
        });
      }
    }
  }

  async catalog(
    platformValue = 'WEB',
    countryValue?: string,
    currencyValue?: string
  ) {
    const platform = platformValue.trim().toUpperCase();
    if (!['WEB', 'ANDROID', 'IOS'].includes(platform)) {
      throw new BadRequestException('Plateforme commerciale invalide.');
    }
    const countryCode = countryValue?.trim().toUpperCase();
    const currency = currencyValue?.trim().toUpperCase();
    const products = await this.prisma.commerceProduct.findMany({
      where: { active: true },
      include: {
        prices: {
          where: {
            active: true,
            platform,
            ...(currency ? { currency } : {}),
            ...(countryCode
              ? { OR: [{ countryCode }, { countryCode: null }] }
              : { countryCode: null })
          },
          orderBy: [{ countryCode: 'desc' }, { unitAmount: 'asc' }]
        }
      },
      orderBy: [{ highlighted: 'desc' }, { createdAt: 'asc' }]
    });
    return products
      .filter((product) => product.prices.length > 0)
      .map((product) => ({
        key: product.key,
        name: product.name,
        description: product.description,
        kind: product.kind,
        highlighted: product.highlighted,
        requiresVerification: product.requiresVerification,
        requiresManualReview: product.requiresManualReview,
        prices: product.prices.map((price) => ({
          id: price.id,
          provider: price.provider,
          platform: price.platform,
          countryCode: price.countryCode,
          currency: price.currency,
          unitAmount: price.unitAmount,
          externalProductId: price.externalProductId
        }))
      }));
  }

  async resolveWebPrice(input: {
    productKey: string;
    provider: 'FLUTTERWAVE' | 'CINETPAY';
    countryCode?: string;
    currency?: string;
  }) {
    const product = await this.prisma.commerceProduct.findUnique({
      where: { key: input.productKey.trim().toLowerCase() },
      include: {
        prices: {
          where: {
            provider: input.provider,
            platform: 'WEB',
            active: true,
            ...(input.currency
              ? { currency: input.currency.trim().toUpperCase() }
              : {}),
            ...(input.countryCode
              ? {
                  OR: [
                    { countryCode: input.countryCode.trim().toUpperCase() },
                    { countryCode: null }
                  ]
                }
              : { countryCode: null })
          },
          orderBy: [{ countryCode: 'desc' }, { unitAmount: 'asc' }]
        }
      }
    });
    if (!product?.active) throw new NotFoundException('Produit commercial indisponible.');
    const price = product.prices[0];
    if (!price) {
      throw new NotFoundException(
        'Aucun prix n’est configuré pour ce fournisseur, cette devise et ce pays.'
      );
    }
    return { product, price };
  }

  async resolveStorePrice(input: {
    productKey: string;
    provider: 'GOOGLE_PLAY' | 'APPLE_APP_STORE';
    externalProductId: string;
  }) {
    const platform = input.provider === 'GOOGLE_PLAY' ? 'ANDROID' : 'IOS';
    const price = await this.prisma.commercePrice.findFirst({
      where: {
        provider: input.provider,
        platform,
        externalProductId: input.externalProductId,
        active: true,
        product: {
          key: input.productKey.trim().toLowerCase(),
          active: true
        }
      },
      include: { product: true }
    });
    if (!price) {
      throw new NotFoundException(
        'Ce produit de boutique mobile n’est pas mappé au catalogue KnowMe.'
      );
    }
    return { product: price.product, price };
  }

  private storePriceSeeds(): PriceSeed[] {
    const raw = this.config.get<string>('PAYMENTS_STORE_CATALOG_JSON')?.trim();
    if (!raw) return [];
    try {
      const values = JSON.parse(raw) as PriceSeed[];
      return values.filter(
        (entry) =>
          PRODUCT_SEEDS.some((product) => product.key === entry.productKey) &&
          ['GOOGLE_PLAY', 'APPLE_APP_STORE'].includes(entry.provider) &&
          ['ANDROID', 'IOS'].includes(entry.platform) &&
          /^[A-Z]{3}$/.test(entry.currency) &&
          Number.isSafeInteger(entry.unitAmount) &&
          entry.unitAmount >= 0 &&
          Boolean(entry.externalProductId)
      );
    } catch {
      throw new BadRequestException('PAYMENTS_STORE_CATALOG_JSON est invalide.');
    }
  }
}
