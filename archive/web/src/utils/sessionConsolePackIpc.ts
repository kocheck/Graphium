/** True when an IPC invoke came from the Architect window, not World View. */
export function isArchitectPackSender(senderId: number, architectId: number | null): boolean {
  return architectId !== null && senderId === architectId;
}
