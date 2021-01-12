import {Component, ElementRef, Input, OnDestroy, OnInit, ViewChild} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {GameService} from '../../services/game.service';
import {EventHandler} from '../../models/eventHandler';
import {environment} from '../../../environments/environment';

@Component({
  selector: 'app-game',
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.scss']
})
export class GameComponent implements OnInit, OnDestroy {
  @Input() name: string;
  @Input() handler: EventHandler;
  @ViewChild('challengeId', { static: true }) challengeInput: ElementRef;
  @ViewChild('challengeBtn', { static: true }) challengeButton: ElementRef;
  private websocket: WebSocket;
  connection: string;
  socketId: string;
  state: number;
  contenders: Map<string, string>;

  constructor(private route: ActivatedRoute,
              private gameService: GameService) {
    this.contenders = new Map();
    // this.contenders.set('cda3ba62-d5e3-27a0-4e9d-a7f99ec05a08', 'guest'); // fixme
    // this.contenders.set('cda3ba62-d5e3-27a0-4e9d-a7f99ec05a09', 'guest'); // fixme
  }

  private emitMessage(message: object): void {
    this.websocket.send(JSON.stringify(message));
  }

  ngOnInit(): void {
    this.connection = 'connecting';
    this.state = 0;
    this.challengeButton.nativeElement.innerHTML = 'Challenge';
    const url = `${this.gameService.wsUrl}/${this.name}`;
    this.websocket = new WebSocket(url);
    this.websocket.onopen = () => {
      this.connection = 'connected';
      console.log(`connected to ${url}`);
    };
    this.websocket.onclose = (message) => {
      this.connection = 'disconnected';
      console.log(`disconnected from ${url}`);
    };
    this.websocket.onerror = (error) => {
      console.error(error);
    };
    this.websocket.onmessage = (message) => {
      this.invokeMessage(message.data);
    };
  }

  private invokeMessage(message: any): void {
    if (!environment.production) {
      console.log(`received message: ${message}`);
    }
    if (typeof message === 'string') {
      const msg = JSON.parse(message);
      if (msg.hasOwnProperty('code') && msg.hasOwnProperty('args')) {
        switch (msg.code) {
          case GameService.SERVER_ID: {
            if (msg.args.hasOwnProperty('id')) {
              this.socketId = msg.args.id;
            }
            break;
          }
          case GameService.SERVER_CHALLENGE: {
            if (msg.args.hasOwnProperty('opponent')) {
              const opponent = msg.args.opponent;
              this.contenders.set(opponent, 'guest');  // fixme
            }
            break;
          }
          case GameService.SERVER_CHALLENGE_ABORT: {
            if (msg.args.hasOwnProperty('opponent')) {
              const opponent = msg.args.opponent;
              this.contenders.delete(opponent);
            }
            break;
          }
          case GameService.SERVER_CHALLENGE_DECLINE: {
            if (msg.args.hasOwnProperty('opponent')) {
              if (this.state === 1 && this.challengeId === msg.args.opponent) {
                this.state = 0;
                this.challengeInputDisable = false;
                this.challengeButtonText = 'Challenge';
              }
            }
            break;
          }
          default: {
            this.handler.invoke(this, msg.code, msg.args);
          }
        }
      }
    }
  }

  get challengeId(): string {
    const input = this.challengeInput.nativeElement;
    return input.value;
  }

  set challengeInputDisable(value: boolean) {
    const input = this.challengeInput.nativeElement;
    input.disabled = value;
  }

  set challengeButtonText(value: string) {
    const button = this.challengeButton.nativeElement;
    button.innerHTML = value;
  }

  onChallenge(): void {
    const input = this.challengeInput.nativeElement;
    if (this.state === 0) {
      this.challengeInputDisable = true;
      this.challengeButtonText = 'Abort';
      this.state = 1;
      this.emitMessage({
        code: GameService.CLIENT_CHALLENGE,
        args: {opponent: input.value}
      });
    } else if (this.state === 1) {
      this.emitMessage({
        code: GameService.CLIENT_CHALLENGE_ABORT,
        args: {opponent: input.value}
      });
      this.state = 0;
      this.challengeInputDisable = false;
      this.challengeButtonText = 'Challenge';
    }
  }

  onChallengeAccept(opponentId: string): void {
    this.emitMessage({
      code: GameService.CLIENT_CHALLENGE_ACCEPT,
      args: {opponent: opponentId}
    });
    this.contenders.delete(opponentId);
  }

  onChallengeDecline(opponentId: string): void {
    this.emitMessage({
      code: GameService.CLIENT_CHALLENGE_DECLINE,
      args: {opponent: opponentId}
    });
    this.contenders.delete(opponentId);
  }

  ngOnDestroy(): void {
    this.websocket.close();
  }
}
