/**
 * Typed library errors. Lets the consumer distinguish an auth problem,
 * a checkpoint, a broken selector, etc.
 */

export class SocialConnectorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Session invalid / expired and no reconnection possible. */
export class NotLoggedInError extends SocialConnectorError {}

/** The provider requires a verification (captcha, 2FA, QR not scanned...). */
export class CheckpointError extends SocialConnectorError {}

/** An expected selector is missing — the provider UI has probably changed. */
export class SelectorError extends SocialConnectorError {}

/** The post / send could not be confirmed. */
export class PostFailedError extends SocialConnectorError {}

/** Unknown / unsupported provider. */
export class UnknownProviderError extends SocialConnectorError {}
