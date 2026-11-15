import React, { useMemo, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView } from "react-native";
import { ChevronDown, ChevronUp, Check, X } from "lucide-react-native";

export interface PickerOption {
  id: string;
  label: string;
  sub?: string;
  /** Original ERP record, when the caller needs more than id/label. */
  raw?: any;
}

interface Props {
  label: string;
  placeholder?: string;
  options: PickerOption[];
  value: PickerOption | null;
  onChange: (opt: PickerOption | null) => void;
  optional?: boolean;
}

/**
 * Inline dropdown used for ERP /options data (staff, customers, products).
 * Collapsed shows the current selection; expanded shows a searchable list.
 */
export default function OptionPicker({
  label,
  placeholder = "Select…",
  options,
  value,
  onChange,
  optional = true,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 60);
    return options
      .filter(
        (o) =>
          o.label.toLowerCase().includes(q) || (o.sub || "").toLowerCase().includes(q)
      )
      .slice(0, 60);
  }, [options, query]);

  return (
    <View>
      <Text className="text-zinc-400 text-xs mb-1">{label}</Text>
      <TouchableOpacity
        onPress={() => setOpen(!open)}
        className="flex-row items-center justify-between bg-[#121215] border border-[#27272A] px-3 py-2.5 rounded-xl"
      >
        <Text className={`text-xs flex-1 ${value ? "text-white font-bold" : "text-zinc-500"}`}>
          {value ? value.label : placeholder}
        </Text>
        {value && optional ? (
          <TouchableOpacity
            onPress={() => onChange(null)}
            hitSlop={8}
            className="mr-1"
          >
            <X color="#71717A" size={14} />
          </TouchableOpacity>
        ) : null}
        {open ? <ChevronUp color="#71717A" size={16} /> : <ChevronDown color="#71717A" size={16} />}
      </TouchableOpacity>

      {open && (
        <View className="mt-1.5 bg-[#121215] border border-[#27272A] rounded-xl overflow-hidden">
          <TextInput
            placeholder="Search…"
            placeholderTextColor="#71717A"
            value={query}
            onChangeText={setQuery}
            className="text-white text-xs px-3 py-2 border-b border-[#27272A]"
          />
          <ScrollView style={{ maxHeight: 220 }} nestedScrollEnabled>
            {filtered.length === 0 ? (
              <Text className="text-zinc-500 text-xs px-3 py-3">No matches</Text>
            ) : (
              filtered.map((o) => (
                <TouchableOpacity
                  key={o.id}
                  onPress={() => {
                    onChange(o);
                    setOpen(false);
                    setQuery("");
                  }}
                  className="flex-row items-center justify-between px-3 py-2.5 border-b border-zinc-800/60"
                >
                  <View className="flex-1">
                    <Text className="text-white text-xs font-semibold">{o.label}</Text>
                    {o.sub ? <Text className="text-zinc-500 text-[10px]">{o.sub}</Text> : null}
                  </View>
                  {value?.id === o.id ? <Check color="#06B6D4" size={14} /> : null}
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
}
