import { useRef } from 'react';
import { Icon } from '@/components/Icons/AutoIcons';
import { useSearchContext } from '@/contexts/search/SearchContextCore';
import styles from './SearchInput.module.scss';

const searchIcon = (
  <Icon name='Search' className={styles['input-search__icon']} />
);

export interface SearchInputProps {
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  onClear?: () => void;
}

const SearchInput = ({
  placeholder = 'Search',
  value: valueProp,
  onChange: onChangeProp,
  onClear: onClearProp,
}: SearchInputProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const context = useSearchContext();
  const isControlled = valueProp !== undefined && onChangeProp !== undefined;
  const value = isControlled ? valueProp : context.term;
  const onChange = isControlled ? onChangeProp : context.onChange;
  const clear = isControlled
    ? (onClearProp ?? (() => onChangeProp?.('')))
    : context.clear;

  return (
    <div className={styles['input-search']}>
      <div className={styles['input-search__inner']}>
        {searchIcon}
        <div className={styles['input-search__input']}>
          <input
            aria-label='Search'
            className={styles['input-search__field']}
            name='term'
            placeholder=' '
            value={value}
            onChange={(e) => onChange(e.target.value)}
            ref={inputRef}
            autoComplete='off'
            type='text'
          />
          <span
            className={`${styles['input-search__placeholder']} ${value ? styles['input-search__placeholder--filled'] : ''}`}
          >
            {placeholder}
          </span>
        </div>
      </div>
      {value && (
        <div className={styles['input-search__clear']} onClick={clear}>
          <Icon name='Cross' className={styles['input-search__clear-icon']} />
        </div>
      )}
    </div>
  );
};

export default SearchInput;
