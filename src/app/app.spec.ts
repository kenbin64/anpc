import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { AiConnection } from './ai/ai-connection';

/**
 * The shell's test. The real AiConnection would try to reach Ollama, so the test provides a stand-in
 * that reports "offline": a test should never depend on something running outside it.
 */
describe('App shell', () => {
  beforeEach(async () => {
    const offlineAi = { status: () => 'offline', model: () => 'llama3.1:8b', checkConnection: async () => 'offline' };
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), { provide: AiConnection, useValue: offlineAi }],
    }).compileComponents();
  });

  it('shows the navigation and the AI status', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('Worlds');
    expect(text).toContain('New world');
    expect(text).toContain('AI offline: start Ollama');
  });
});
