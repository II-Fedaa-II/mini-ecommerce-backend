import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';

/**
 * Brute-force protection for the login endpoint.
 *
 * Keyed on IP **and** the submitted email rather than IP alone: keying only on IP lets
 * one attacker behind a shared NAT lock out every legitimate user from that address,
 * while keying only on email lets a botnet spread attempts across many IPs. Combining
 * both throttles the thing an attacker actually iterates — guesses against one account.
 */
@Injectable()
export class LoginThrottlerGuard extends ThrottlerGuard {
  protected getTracker(req: Request): Promise<string> {
    const raw =
      typeof req.body === 'object' && req.body !== null
        ? (req.body as { email?: unknown }).email
        : undefined;
    const email = typeof raw === 'string' ? raw : '';

    const ip = req.ips?.length ? req.ips[0] : req.ip;
    return Promise.resolve(`login:${ip}:${email.toLowerCase()}`);
  }
}
