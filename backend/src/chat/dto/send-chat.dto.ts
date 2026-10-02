import { IsString, MaxLength } from 'class-validator';

/** Body of POST /api/creatures/:id/chat. */
export class SendChatDto {
  // Only bounds the payload. The length rule (chatMessageMaxChars after
  // trimming) lives in ChatService, so its 400 carries a friendly message.
  @IsString()
  @MaxLength(2000)
  text!: string;
}
