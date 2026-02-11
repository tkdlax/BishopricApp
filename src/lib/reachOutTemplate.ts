/**
 * Reach-out-to-schedule message: one standard wording for all interview types.
 * "Hello [recipient], I'm reaching out on behalf of bishop [bishop last name], he'd love to schedule a time for [interview type]. Are you available this coming sunday?"
 */

export interface InterviewTypeOption {
  type: string;
  name: string; // display for picker and for "[interview type]" in message (e.g. "a bishop interview")
}

/** Same interview types used for scheduling/confirmation elsewhere. Display name used in the reach-out sentence. */
export const REACH_OUT_INTERVIEW_TYPES: InterviewTypeOption[] = [
  { type: 'standard_interview', name: 'a bishop interview' },
  { type: 'youth_interview', name: 'a youth interview' },
  { type: 'tithing_declaration', name: 'tithing declaration' },
];

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
