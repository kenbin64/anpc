import { Pipe, PipeTransform } from '@angular/core';

/**
 * A PIPE: turns an hour into words for the screen. `{{ 20 | timeOfDay }}` shows "8 in the evening".
 * Pipes are PURE by default, so Angular only works this out again when the hour changes.
 */
@Pipe({ name: 'timeOfDay' })
export class TimeOfDayPipe implements PipeTransform {
  transform(hour: number): string {
    const clock = hour % 12 === 0 ? 12 : hour % 12;
    let part = 'at night';
    if (hour >= 5 && hour < 12) part = 'in the morning';
    else if (hour >= 12 && hour < 17) part = 'in the afternoon';
    else if (hour >= 17 && hour < 21) part = 'in the evening';
    const words = hour === 12 ? 'noon' : hour === 0 ? 'midnight' : `${clock} ${part}`;
    return words;
  }
}
