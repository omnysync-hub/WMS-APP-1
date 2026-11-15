import React, { useMemo, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView } from "react-native";
import { Search, ChevronDown, Check } from "lucide-react-native";

export interface PickerItem {
  id: string;
  label: string;
  sub?: string;
}

interface Props {
  placeholder: string;
  items: PickerItem[];
  selectedId?: string | null;
  onSelect: (item: PickerItem) => void;
  emptyText?: string;
}

/**
 * Inline collapsible searchable picker, styled to match the app's dark
 * expandable-form pattern. Used for staff, customers and products from
 * GET /api/workshops/options.
 */
export function SearchPicker({ placeholder, items, selectedId, onSelect, emptyText }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = items.find((i) => i.id === selectedId) || null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items.slice(0, 30);
    return items
      .filter(
        (i) =>
          i.label.toLowerCase().includes(q) || (i.sub || "").toLowerCase().includes(q)
      )
      .slice(0, 30);
  }, [items, query]);

  return (
    <View>
      <TouchableOpacity
        onPress={() => setOpen(!open)}
        className="flex-row items-center justify-between bg-[#18181B] border border-[#27272A] rounded-lg px-2.5 py-2"
      >
        <Text className={`text-xs ${selected ? "text-white font-semibold" : "text-zinc-500"}`}>
          {selected ? selected.label : placeholder}
        </Text>
        <ChevronDown color="#71717A" size={14} />
      </TouchableOpacity>

      {open && (
        <View className="mt-1.5 bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden">
          <View className="flex-row items-center px-2.5 py-1.5 border-b border-zinc-800">
            <Search color="#71717A" size={13} />
            <TextInput
              placeholder="Type to search..."
              placeholderTextColor="#71717A"
              value={query}
              onChangeText={setQuery}
              className="flex-1 text-white text-xs ml-2 py-0"
            />
          </View>
          <ScrollView style={{ maxHeight: 180 }} nestedScrollEnabled>
            {filtered.length === 0 ? (
              <Text className="text-zinc-500 text-xs px-3 py-2.5">
                {emptyText || "No matches found"}
              </Text>
            ) : (
              filtered.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => {
                    onSelect(item);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="flex-row items-center justify-between px-3 py-2 border-b border-zinc-900"
                >
                  <View className="flex-1 pr-2">
                    <Text className="text-white text-xs font-semibold">{item.label}</Text>
                    {!!item.sub && <Text className="text-zinc-500 text-[10px]">{item.sub}</Text>}
                  </View>
                  {item.id === selectedId && <Check color="#F59E0B" size={14} />}
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}
