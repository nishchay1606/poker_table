// Hand-written to mirror `supabase gen types typescript`. Regenerate against the real project with:
//   npx supabase gen types typescript --project-id <id> > types/database.ts

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      buyin_transactions: {
        Row: {
          amount: number
          created_at: string
          id: string
          table_player_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          table_player_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          table_player_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "buyin_transactions_table_player_id_fkey"
            columns: ["table_player_id"]
            isOneToOne: false
            referencedRelation: "table_player_summary"
            referencedColumns: ["table_player_id"]
          },
          {
            foreignKeyName: "buyin_transactions_table_player_id_fkey"
            columns: ["table_player_id"]
            isOneToOne: false
            referencedRelation: "table_players"
            referencedColumns: ["id"]
          },
        ]
      }
      game_tables: {
        Row: {
          buy_in_amount: number
          closed_at: string | null
          created_at: string
          id: string
          name: string
          status: string
        }
        Insert: {
          buy_in_amount?: number
          closed_at?: string | null
          created_at?: string
          id?: string
          name: string
          status?: string
        }
        Update: {
          buy_in_amount?: number
          closed_at?: string | null
          created_at?: string
          id?: string
          name?: string
          status?: string
        }
        Relationships: []
      }
      players: {
        Row: {
          created_at: string
          id: string
          is_archived: boolean
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_archived?: boolean
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          is_archived?: boolean
          name?: string
        }
        Relationships: []
      }
      table_players: {
        Row: {
          cash_out: number | null
          id: string
          joined_at: string
          player_id: string
          table_id: string
        }
        Insert: {
          cash_out?: number | null
          id?: string
          joined_at?: string
          player_id: string
          table_id: string
        }
        Update: {
          cash_out?: number | null
          id?: string
          joined_at?: string
          player_id?: string
          table_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "table_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_players_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "game_tables"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      overall_leaderboard: {
        Row: {
          biggest_win: number | null
          net: number | null
          player_id: string | null
          player_name: string | null
          tables_played: number | null
          total_buyin: number | null
          total_cash_out: number | null
        }
        Relationships: []
      }
      table_player_summary: {
        Row: {
          buyin_count: number | null
          cash_out: number | null
          joined_at: string | null
          net: number | null
          player_id: string | null
          player_name: string | null
          table_id: string | null
          table_player_id: string | null
          total_buyin: number | null
        }
        Relationships: [
          {
            foreignKeyName: "table_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "table_players_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "game_tables"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_and_seat_player: {
        Args: { p_name: string; p_table_id: string }
        Returns: string
      }
      change_buyin: {
        Args: { p_direction: number; p_table_player_id: string }
        Returns: undefined
      }
      close_table: {
        Args: { p_table_id: string }
        Returns: undefined
      }
      create_player: {
        Args: { p_name: string }
        Returns: {
          created_at: string
          id: string
          is_archived: boolean
          name: string
        }
        SetofOptions: {
          from: "*"
          to: "players"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_table: {
        Args: { p_buy_in_amount?: number; p_name: string }
        Returns: string
      }
      remove_table_player: {
        Args: { p_table_player_id: string }
        Returns: undefined
      }
      rename_player: {
        Args: { p_name: string; p_player_id: string }
        Returns: undefined
      }
      reopen_table: {
        Args: { p_table_id: string }
        Returns: undefined
      }
      seat_player: {
        Args: { p_player_id: string; p_table_id: string }
        Returns: string
      }
      set_cash_out: {
        Args: { p_amount: number | null; p_table_player_id: string }
        Returns: undefined
      }
      set_player_archived: {
        Args: { p_archived: boolean; p_player_id: string }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  TableName extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"]),
> = (DefaultSchema["Tables"] & DefaultSchema["Views"])[TableName] extends {
  Row: infer R
}
  ? R
  : never

export type TablesInsert<TableName extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][TableName] extends { Insert: infer I } ? I : never

export type TablesUpdate<TableName extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][TableName] extends { Update: infer U } ? U : never
