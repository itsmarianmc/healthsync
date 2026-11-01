import type { FoodSearchResult } from '../../_lib/types';

export default function FoodAvatar({ food }: { food: Pick<FoodSearchResult, 'name' | 'emoji'> }) {
    const icon = food.emoji?.trim();
    return <span className="saved-food-avatar" aria-hidden="true">
        {icon && /^fa-(solid|regular) fa-[a-z0-9-]+$/.test(icon) ? <i className={icon} />
            : icon && icon.length <= 16 && /\p{Extended_Pictographic}/u.test(icon) ? icon : food.name.charAt(0)}
    </span>;
}
