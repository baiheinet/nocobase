/**
 * This file is part of the NocoBase (R) project.
 * Copyright (c) 2020-2024 NocoBase Co., Ltd.
 * Authors: NocoBase Team.
 *
 * This project is dual-licensed under AGPL-3.0 and NocoBase Commercial License.
 * For more information, please refer to: https://www.nocobase.com/agreement.
 */

import React, { useState } from 'react';
import { AutoComplete, Input } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { IMapAdapter, SearchResult } from './adapters';
import { useMapTranslation } from '../../locale';

export interface SearchProps {
  adapter: IMapAdapter | null;
  onSelect?: (location: [number, number], result: SearchResult) => void;
  placeholder?: string;
}

/**
 * Unified search component for all map types
 */
export const Search: React.FC<SearchProps> = ({ adapter, onSelect, placeholder }) => {
  const { t } = useMapTranslation();
  const [options, setOptions] = useState<{ value: string; label: string; data: SearchResult }[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (value: string) => {
    if (!value || !adapter || !adapter.searchPOI) {
      setOptions([]);
      return;
    }

    setLoading(true);
    try {
      const results = await adapter.searchPOI(value);
      const newOptions = results.map((result) => ({
        value: result.name,
        label: result.address ? `${result.name} - ${result.address}` : result.name,
        data: result,
      }));
      setOptions(newOptions);
    } catch (error) {
      console.error('Search error:', error);
      setOptions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (value: string, option: any) => {
    if (option?.data && onSelect) {
      onSelect(option.data.location, option.data);
      // Clear search after selection
      setOptions([]);
    }
  };

  // Check if adapter supports search
  if (!adapter || !adapter.searchPOI) {
    return null;
  }

  return (
    <AutoComplete
      style={{ width: 300 }}
      options={options}
      onSearch={handleSearch}
      onSelect={handleSelect}
      notFoundContent={loading ? t('Searching...') : t('No results')}
    >
      <Input placeholder={placeholder || t('Search location')} prefix={<SearchOutlined />} allowClear />
    </AutoComplete>
  );
};
