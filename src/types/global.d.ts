// Strong typing for next-intl — inferred from the Spanish message file (source of truth)
import type esMessages from '../messages/es.json';

type Messages = typeof esMessages;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface IntlMessages extends Messages {}
}
