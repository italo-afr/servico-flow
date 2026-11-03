import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Injectable,
  NestMiddleware,
  PipeTransform,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError, invalid } from './errors.js';
import { log } from './logger.js';

declare module 'express-serve-static-core' {
  interface Request {
    requestId: string;
  }
}

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const incoming = req.header('x-request-id');
    req.requestId = incoming && /^[\w-]{8,64}$/.test(incoming) ? incoming : randomUUID();
    res.setHeader('x-request-id', req.requestId);
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      log('info', 'http_request', {
        requestId: req.requestId,
        method: req.method,
        // rota normalizada: evita IDs e tokens no log
        route: (req.route as { path?: string } | undefined)?.path ?? 'unmatched',
        status: res.statusCode,
        durationMs: Number(process.hrtime.bigint() - start) / 1e6,
      });
    });
    next();
  }
}

/** Converte qualquer erro no formato {code, message, requestId, fields}. Sem stack/SQL na resposta. */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();
    const requestId = req.requestId ?? randomUUID();
    if (exception instanceof AppError) {
      res.status(exception.status).json({
        code: exception.code,
        message: exception.message,
        requestId,
        ...(exception.fields ? { fields: exception.fields } : {}),
      });
      return;
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const code =
        status === 404 ? 'NOT_FOUND' : status === 413 ? 'PAYLOAD_TOO_LARGE' : 'HTTP_ERROR';
      res.status(status).json({
        code,
        message: status === 404 ? 'Rota não encontrada.' : exception.message,
        requestId,
      });
      return;
    }
    const pgCode = (exception as { code?: string })?.code;
    if (pgCode === '40001' || pgCode === '40P01') {
      res.status(409).json({
        code: 'CONCURRENT_UPDATE',
        message: 'Conflito de concorrência; tente novamente.',
        requestId,
      });
      return;
    }
    log('error', 'unhandled_error', {
      requestId,
      error: (exception as Error)?.message,
      pgCode,
      stack: (exception as Error)?.stack,
    });
    res.status(500).json({
      code: 'INTERNAL',
      message: 'Erro inesperado. Informe o código ao suporte.',
      requestId,
    });
  }
}

/** Validação com zod: rejeita campos desconhecidos quando o schema for strict. */
export class ZodPipe<T extends z.ZodType> implements PipeTransform {
  constructor(private readonly schema: T) {}
  transform(value: unknown): z.infer<T> {
    const r = this.schema.safeParse(value ?? {});
    if (!r.success) {
      const fields: Record<string, string[]> = {};
      for (const issue of r.error.issues) {
        const key = issue.path.join('.') || '_';
        (fields[key] ??= []).push(issue.message);
      }
      throw invalid('Dados inválidos.', fields);
    }
    return r.data;
  }
}
