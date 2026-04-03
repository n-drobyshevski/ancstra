import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const sexColors = {
  M: { bg: 'var(--sex-male-bg)', text: 'var(--sex-male)' },
  F: { bg: 'var(--sex-female-bg)', text: 'var(--sex-female)' },
  U: { bg: 'var(--sex-unknown-bg)', text: 'var(--sex-unknown)' },
} as const;

interface PersonAvatarProps {
  givenName: string;
  surname: string;
  sex: 'M' | 'F' | 'U';
}

export function PersonAvatar({ givenName, surname, sex }: PersonAvatarProps) {
  const colors = sexColors[sex] ?? sexColors.U;
  const initials = `${givenName[0] ?? ''}${surname[0] ?? ''}`.toUpperCase();

  return (
    <Avatar>
      <AvatarFallback style={{ backgroundColor: colors.bg, color: colors.text }}>
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
