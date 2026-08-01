import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * NestJS ne fournit pas une classe TooManyRequestsException dans toutes les
 * versions. Ce module ajoute une implémentation compatible avant le chargement
 * des modules applicatifs, tout en conservant le statut HTTP 429 attendu.
 */
declare module '@nestjs/common' {
  export class TooManyRequestsException extends HttpException {
    constructor(message?: string | object);
  }
}

type NestCommonRuntime = typeof import('@nestjs/common') & {
  TooManyRequestsException?: new (message?: string | object) => HttpException;
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const nestCommon = require('@nestjs/common') as NestCommonRuntime;

if (!nestCommon.TooManyRequestsException) {
  class CompatibleTooManyRequestsException extends HttpException {
    constructor(message: string | object = 'Too Many Requests') {
      super(message, HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  nestCommon.TooManyRequestsException = CompatibleTooManyRequestsException;
}

export {};
