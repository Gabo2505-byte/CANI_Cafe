// Bitácora ligada a la instancia de Firestore de la app (se mockea en las pruebas de pantallas).
import { db } from '../shared/firebase/config';
import type { Contact } from '../shared/types';
import type { Timeline } from './timeline';
import { listTimelineContactsIn, loadContactTimelineIn } from './timelineRepository';

export function listTimelineContacts(): Promise<Contact[]> {
  return listTimelineContactsIn(db);
}

export function loadContactTimeline(contactId: string): Promise<Timeline> {
  return loadContactTimelineIn(db, contactId);
}
