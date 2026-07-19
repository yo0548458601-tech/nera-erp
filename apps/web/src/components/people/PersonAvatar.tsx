import { type PersonProfile, getPersonFullName } from '@nera/entity-engine';

type PersonAvatarProps = {
  profile: Pick<PersonProfile, 'firstName' | 'lastName' | 'profileImageUrl'>;
  size?: 'sm' | 'md' | 'lg';
};

const sizeClasses = {
  sm: 'h-9 w-9 text-sm',
  md: 'h-12 w-12 text-base',
  lg: 'h-16 w-16 text-xl',
};

/** Profile image placeholder: initials avatar, ready to swap in a real image later. */
export function PersonAvatar({ profile, size = 'md' }: PersonAvatarProps) {
  const initials = getPersonFullName(profile)
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part.charAt(0))
    .join('');

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full bg-slate-900 font-semibold text-white ${sizeClasses[size]}`}
      aria-hidden="true"
    >
      {initials || '?'}
    </div>
  );
}
