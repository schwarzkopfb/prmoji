export default interface SlackEvent {
  event: {
    client_msg_id: string;
    text: string;
    channel: string;
    event_ts: string;
  };
}
