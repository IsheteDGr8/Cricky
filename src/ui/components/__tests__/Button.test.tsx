import { fireEvent, render, screen } from '@testing-library/react-native';

import { AppThemeProvider } from '../../theme';
import { Button, type ButtonProps } from '../Button';

async function renderButton(props: Partial<ButtonProps> = {}) {
  const onPress = jest.fn();
  await render(
    <AppThemeProvider scheme="light">
      <Button label="Start match" onPress={onPress} {...props} />
    </AppThemeProvider>,
  );
  return { onPress };
}

describe('Button', () => {
  it('exposes an accessible button and calls onPress', async () => {
    const { onPress } = await renderButton();
    await fireEvent.press(screen.getByRole('button', { name: 'Start match' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', async () => {
    const { onPress } = await renderButton({ disabled: true });
    await fireEvent.press(screen.getByRole('button', { name: 'Start match' }));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('shows a spinner instead of the label while loading', async () => {
    await renderButton({ loading: true });
    expect(screen.queryByText('Start match')).toBeNull();
    expect(screen.getByRole('button')).toHaveProp('accessibilityState', {
      disabled: true,
      busy: true,
    });
  });
});
