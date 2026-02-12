/**
 * Reach-out-to-schedule message: one standard wording for all interview types.
 * "Hello [recipient], I'm reaching out on behalf of bishop [bishop last name], he'd love to schedule a time for [interview type]. Are you available this coming sunday?"
 */

export interface InterviewTypeOption {
  type: string;
  name: string; // display in picker / UI
  /** Optional text for message templates (e.g. "interview with bishop"). If omitted, name is used. */
  messageText?: string;
}

/** Same interview types used for scheduling/confirmation elsewhere. */
export const REACH_OUT_INTERVIEW_TYPES: InterviewTypeOption[] = [
  { type: 'bishop_interview', name: 'Bishop interview', messageText: 'interview with bishop' },
  { type: 'temple_recommend', name: 'Temple Recommend' },
  { type: 'youth_annual', name: 'Youth Annual' },
  { type: 'youth_semi_annual', name: 'Youth Semi Annual' },
  { type: 'ordinance', name: 'Ordinance (baptism/priesthood)' },
  { type: 'mission_prep', name: 'Mission Prep' },
  { type: 'ecclesiastical_endorsement', name: 'Ecclesiastical Endorsement' },
  { type: 'patriarchal_blessing', name: 'Patriarchal Blessing' },
  { type: 'tithing_declaration', name: 'Tithing Declaration' },
];

/** Text to use in message templates for this interview type (e.g. "interview with bishop"). */
export function getMessageTextForType(type: string): string {
  const t = REACH_OUT_INTERVIEW_TYPES.find((x) => x.type === type);
  return (t?.messageText ?? t?.name ?? 'interview').trim() || 'interview';
}

const REACH_OUT_SENTENCE =
  "Hello {recipient}, I'm reaching out on behalf of {bishopPhrase}, he'd love to schedule a time for {interviewType}. Are you available this coming sunday?";

/**
 * Build the reach-out message. All reach-out templates use this wording.
 */
export function buildReachOutMessage(
  recipientName: string,
  bishopLastName: string,
  interviewTypeDisplay: string
): string {
  const recipient = recipientName.trim() || 'there';
  const bishopPhrase = bishopLastName.trim() ? `bishop ${bishopLastName.trim()}` : 'the bishop';
  const type = interviewTypeDisplay.trim() || 'an interview';
  return REACH_OUT_SENTENCE
    .replace(/\{recipient\}/g, recipient)
    .replace(/\{bishopPhrase\}/g, bishopPhrase)
    .replace(/\{interviewType\}/g, type);
}
