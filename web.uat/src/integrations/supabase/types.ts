export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      comment_reactions: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          reaction_type: Database["public"]["Enums"]["reaction_type"]
          user_id: string | null
          wallet_id: string | null
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          reaction_type: Database["public"]["Enums"]["reaction_type"]
          user_id?: string | null
          wallet_id?: string | null
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          reaction_type?: Database["public"]["Enums"]["reaction_type"]
          user_id?: string | null
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comment_reactions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "market_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_reports: {
        Row: {
          comment_id: string
          created_at: string
          id: string
          reason: string
          reporter_user_id: string | null
          reporter_wallet_id: string | null
          status: Database["public"]["Enums"]["report_status"]
        }
        Insert: {
          comment_id: string
          created_at?: string
          id?: string
          reason: string
          reporter_user_id?: string | null
          reporter_wallet_id?: string | null
          status?: Database["public"]["Enums"]["report_status"]
        }
        Update: {
          comment_id?: string
          created_at?: string
          id?: string
          reason?: string
          reporter_user_id?: string | null
          reporter_wallet_id?: string | null
          status?: Database["public"]["Enums"]["report_status"]
        }
        Relationships: [
          {
            foreignKeyName: "comment_reports_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "market_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      event_markets: {
        Row: {
          category_id: string
          change_24h: number
          collateral_type: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string
          featured_order: number | null
          governance_status:
            | Database["public"]["Enums"]["governance_status"]
            | null
          id: string
          image_url: string | null
          important_notes: string | null
          is_active: boolean
          is_featured: boolean
          is_new: boolean
          is_trending: boolean
          liquidity: number
          market_format: string | null
          market_structure: string
          maximum_bet: number | null
          minimum_bet: number
          name: string
          no_price: number
          no_token_id: string | null
          options_count: number | null
          oracle_config: Json | null
          oracle_type: Database["public"]["Enums"]["oracle_type"] | null
          participants_count: number | null
          proposal_id: string | null
          relevance: string | null
          resolution_criteria: string | null
          resolution_date: string | null
          resolution_notes: string | null
          resolution_status: Database["public"]["Enums"]["resolution_status"]
          resolved_value: boolean | null
          smart_contract_address: string | null
          sort_order: number
          subcategory_id: string | null
          total_shares: number
          updated_at: string
          volume: number
          why_it_matters: string | null
          yes_price: number
          yes_token_id: string | null
        }
        Insert: {
          category_id: string
          change_24h?: number
          collateral_type?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date: string
          featured_order?: number | null
          governance_status?:
            | Database["public"]["Enums"]["governance_status"]
            | null
          id?: string
          image_url?: string | null
          important_notes?: string | null
          is_active?: boolean
          is_featured?: boolean
          is_new?: boolean
          is_trending?: boolean
          liquidity?: number
          market_format?: string | null
          market_structure?: string
          maximum_bet?: number | null
          minimum_bet?: number
          name: string
          no_price?: number
          no_token_id?: string | null
          options_count?: number | null
          oracle_config?: Json | null
          oracle_type?: Database["public"]["Enums"]["oracle_type"] | null
          participants_count?: number | null
          proposal_id?: string | null
          relevance?: string | null
          resolution_criteria?: string | null
          resolution_date?: string | null
          resolution_notes?: string | null
          resolution_status?: Database["public"]["Enums"]["resolution_status"]
          resolved_value?: boolean | null
          smart_contract_address?: string | null
          sort_order?: number
          subcategory_id?: string | null
          total_shares?: number
          updated_at?: string
          volume?: number
          why_it_matters?: string | null
          yes_price?: number
          yes_token_id?: string | null
        }
        Update: {
          category_id?: string
          change_24h?: number
          collateral_type?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string
          featured_order?: number | null
          governance_status?:
            | Database["public"]["Enums"]["governance_status"]
            | null
          id?: string
          image_url?: string | null
          important_notes?: string | null
          is_active?: boolean
          is_featured?: boolean
          is_new?: boolean
          is_trending?: boolean
          liquidity?: number
          market_format?: string | null
          market_structure?: string
          maximum_bet?: number | null
          minimum_bet?: number
          name?: string
          no_price?: number
          no_token_id?: string | null
          options_count?: number | null
          oracle_config?: Json | null
          oracle_type?: Database["public"]["Enums"]["oracle_type"] | null
          participants_count?: number | null
          proposal_id?: string | null
          relevance?: string | null
          resolution_criteria?: string | null
          resolution_date?: string | null
          resolution_notes?: string | null
          resolution_status?: Database["public"]["Enums"]["resolution_status"]
          resolved_value?: boolean | null
          smart_contract_address?: string | null
          sort_order?: number
          subcategory_id?: string | null
          total_shares?: number
          updated_at?: string
          volume?: number
          why_it_matters?: string | null
          yes_price?: number
          yes_token_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_markets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "market_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_markets_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "market_proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_markets_subcategory_id_fkey"
            columns: ["subcategory_id"]
            isOneToOne: false
            referencedRelation: "market_subcategories"
            referencedColumns: ["id"]
          },
        ]
      }
      flagged_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          market_id: string
          moderation_categories: Json | null
          moderation_reason: string
          user_id: string | null
          wallet_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          market_id: string
          moderation_categories?: Json | null
          moderation_reason: string
          user_id?: string | null
          wallet_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          market_id?: string
          moderation_categories?: Json | null
          moderation_reason?: string
          user_id?: string | null
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flagged_comments_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "event_markets"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key: string
          setting_value: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      hedera_wallets: {
        Row: {
          account_id: string
          created_at: string
          id: string
          is_primary: boolean
          last_connected_at: string
          persona_color: string | null
          persona_name: string | null
          public_key: string | null
          updated_at: string
          user_id: string | null
          wallet_name: string | null
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          is_primary?: boolean
          last_connected_at?: string
          persona_color?: string | null
          persona_name?: string | null
          public_key?: string | null
          updated_at?: string
          user_id?: string | null
          wallet_name?: string | null
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          last_connected_at?: string
          persona_color?: string | null
          persona_name?: string | null
          public_key?: string | null
          updated_at?: string
          user_id?: string | null
          wallet_name?: string | null
        }
        Relationships: []
      }
      image_files: {
        Row: {
          alt_text: string | null
          created_at: string
          filename: string
          id: string
          keywords: string[] | null
          updated_at: string
          uploaded_by: string | null
          url: string
        }
        Insert: {
          alt_text?: string | null
          created_at?: string
          filename: string
          id?: string
          keywords?: string[] | null
          updated_at?: string
          uploaded_by?: string | null
          url: string
        }
        Update: {
          alt_text?: string | null
          created_at?: string
          filename?: string
          id?: string
          keywords?: string[] | null
          updated_at?: string
          uploaded_by?: string | null
          url?: string
        }
        Relationships: []
      }
      market_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      market_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          is_active: boolean
          market_id: string
          parent_comment_id: string | null
          position: Database["public"]["Enums"]["comment_position"] | null
          updated_at: string
          user_id: string | null
          wallet_id: string | null
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          is_active?: boolean
          market_id: string
          parent_comment_id?: string | null
          position?: Database["public"]["Enums"]["comment_position"] | null
          updated_at?: string
          user_id?: string | null
          wallet_id?: string | null
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          is_active?: boolean
          market_id?: string
          parent_comment_id?: string | null
          position?: Database["public"]["Enums"]["comment_position"] | null
          updated_at?: string
          user_id?: string | null
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "market_comments_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "event_markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "market_comments"
            referencedColumns: ["id"]
          },
        ]
      }
      market_deployment_queue: {
        Row: {
          created_at: string
          deployed_at: string | null
          deployment_attempts: number
          deployment_error: string | null
          deployment_status: string
          id: string
          max_attempts: number
          no_token_id: string | null
          priority: number
          proposal_id: string
          scheduled_for: string | null
          smart_contract_address: string | null
          updated_at: string
          yes_token_id: string | null
        }
        Insert: {
          created_at?: string
          deployed_at?: string | null
          deployment_attempts?: number
          deployment_error?: string | null
          deployment_status?: string
          id?: string
          max_attempts?: number
          no_token_id?: string | null
          priority?: number
          proposal_id: string
          scheduled_for?: string | null
          smart_contract_address?: string | null
          updated_at?: string
          yes_token_id?: string | null
        }
        Update: {
          created_at?: string
          deployed_at?: string | null
          deployment_attempts?: number
          deployment_error?: string | null
          deployment_status?: string
          id?: string
          max_attempts?: number
          no_token_id?: string | null
          priority?: number
          proposal_id?: string
          scheduled_for?: string | null
          smart_contract_address?: string | null
          updated_at?: string
          yes_token_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "market_deployment_queue_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "market_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      market_options: {
        Row: {
          candidate_avatar: string | null
          candidate_metadata: Json | null
          candidate_name: string | null
          candidate_party: string | null
          created_at: string
          current_price: number
          id: string
          is_active: boolean
          market_id: string
          option_name: string
          option_type: string
          sort_order: number | null
          total_shares: number
          updated_at: string
        }
        Insert: {
          candidate_avatar?: string | null
          candidate_metadata?: Json | null
          candidate_name?: string | null
          candidate_party?: string | null
          created_at?: string
          current_price?: number
          id?: string
          is_active?: boolean
          market_id: string
          option_name: string
          option_type: string
          sort_order?: number | null
          total_shares?: number
          updated_at?: string
        }
        Update: {
          candidate_avatar?: string | null
          candidate_metadata?: Json | null
          candidate_name?: string | null
          candidate_party?: string | null
          created_at?: string
          current_price?: number
          id?: string
          is_active?: boolean
          market_id?: string
          option_name?: string
          option_type?: string
          sort_order?: number | null
          total_shares?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_options_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "event_markets"
            referencedColumns: ["id"]
          },
        ]
      }
      market_price_history: {
        Row: {
          created_at: string
          id: string
          market_id: string
          option_id: string
          price: number
          timestamp: string
          volume: number
        }
        Insert: {
          created_at?: string
          id?: string
          market_id: string
          option_id: string
          price: number
          timestamp?: string
          volume?: number
        }
        Update: {
          created_at?: string
          id?: string
          market_id?: string
          option_id?: string
          price?: number
          timestamp?: string
          volume?: number
        }
        Relationships: [
          {
            foreignKeyName: "market_price_history_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "event_markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_price_history_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "market_options"
            referencedColumns: ["id"]
          },
        ]
      }
      market_proposals: {
        Row: {
          collateral_type: string | null
          cooldown_until: string | null
          created_at: string
          deployed_market_id: string | null
          deployment_tx_hash: string | null
          description: string
          election_end_date: string | null
          election_start_date: string | null
          election_votes_abstain: number
          election_votes_against: number
          election_votes_for: number
          election_voting_power_abstain: number
          election_voting_power_against: number
          election_voting_power_for: number
          failure_reason: string | null
          governance_status: Database["public"]["Enums"]["governance_status"]
          hcs_message_id: string | null
          hcs_topic_id: string | null
          id: string
          image_url: string | null
          initial_liquidity: number | null
          market_description: string | null
          market_outcomes: Json | null
          market_title: string | null
          oracle_config: Json | null
          oracle_type: Database["public"]["Enums"]["oracle_type"] | null
          proposal_type: Database["public"]["Enums"]["proposal_type"]
          proposal_votes_abstain: number
          proposal_votes_against: number
          proposal_votes_for: number
          proposal_voting_power_abstain: number
          proposal_voting_power_against: number
          proposal_voting_power_for: number
          proposer_id: string
          proposer_wallet_id: string | null
          resolution_date: string | null
          title: string
          updated_at: string
          voting_end_date: string | null
          voting_start_date: string | null
        }
        Insert: {
          collateral_type?: string | null
          cooldown_until?: string | null
          created_at?: string
          deployed_market_id?: string | null
          deployment_tx_hash?: string | null
          description: string
          election_end_date?: string | null
          election_start_date?: string | null
          election_votes_abstain?: number
          election_votes_against?: number
          election_votes_for?: number
          election_voting_power_abstain?: number
          election_voting_power_against?: number
          election_voting_power_for?: number
          failure_reason?: string | null
          governance_status?: Database["public"]["Enums"]["governance_status"]
          hcs_message_id?: string | null
          hcs_topic_id?: string | null
          id?: string
          image_url?: string | null
          initial_liquidity?: number | null
          market_description?: string | null
          market_outcomes?: Json | null
          market_title?: string | null
          oracle_config?: Json | null
          oracle_type?: Database["public"]["Enums"]["oracle_type"] | null
          proposal_type?: Database["public"]["Enums"]["proposal_type"]
          proposal_votes_abstain?: number
          proposal_votes_against?: number
          proposal_votes_for?: number
          proposal_voting_power_abstain?: number
          proposal_voting_power_against?: number
          proposal_voting_power_for?: number
          proposer_id: string
          proposer_wallet_id?: string | null
          resolution_date?: string | null
          title: string
          updated_at?: string
          voting_end_date?: string | null
          voting_start_date?: string | null
        }
        Update: {
          collateral_type?: string | null
          cooldown_until?: string | null
          created_at?: string
          deployed_market_id?: string | null
          deployment_tx_hash?: string | null
          description?: string
          election_end_date?: string | null
          election_start_date?: string | null
          election_votes_abstain?: number
          election_votes_against?: number
          election_votes_for?: number
          election_voting_power_abstain?: number
          election_voting_power_against?: number
          election_voting_power_for?: number
          failure_reason?: string | null
          governance_status?: Database["public"]["Enums"]["governance_status"]
          hcs_message_id?: string | null
          hcs_topic_id?: string | null
          id?: string
          image_url?: string | null
          initial_liquidity?: number | null
          market_description?: string | null
          market_outcomes?: Json | null
          market_title?: string | null
          oracle_config?: Json | null
          oracle_type?: Database["public"]["Enums"]["oracle_type"] | null
          proposal_type?: Database["public"]["Enums"]["proposal_type"]
          proposal_votes_abstain?: number
          proposal_votes_against?: number
          proposal_votes_for?: number
          proposal_voting_power_abstain?: number
          proposal_voting_power_against?: number
          proposal_voting_power_for?: number
          proposer_id?: string
          proposer_wallet_id?: string | null
          resolution_date?: string | null
          title?: string
          updated_at?: string
          voting_end_date?: string | null
          voting_start_date?: string | null
        }
        Relationships: []
      }
      market_subcategories: {
        Row: {
          category_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number | null
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number | null
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_subcategories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "market_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_votes: {
        Row: {
          created_at: string
          hcs_message_id: string | null
          id: string
          is_proposal_phase: boolean
          proposal_id: string
          vote_choice: Database["public"]["Enums"]["vote_choice"]
          voter_id: string | null
          voting_power: number
          wallet_id: string | null
          wallet_signature: string
        }
        Insert: {
          created_at?: string
          hcs_message_id?: string | null
          id?: string
          is_proposal_phase?: boolean
          proposal_id: string
          vote_choice: Database["public"]["Enums"]["vote_choice"]
          voter_id?: string | null
          voting_power: number
          wallet_id?: string | null
          wallet_signature: string
        }
        Update: {
          created_at?: string
          hcs_message_id?: string | null
          id?: string
          is_proposal_phase?: boolean
          proposal_id?: string
          vote_choice?: Database["public"]["Enums"]["vote_choice"]
          voter_id?: string | null
          voting_power?: number
          wallet_id?: string | null
          wallet_signature?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_votes_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "market_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      secrets: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      staking_positions: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          stake_duration: number
          stake_end_date: string
          stake_start_date: string
          staked_amount: number
          updated_at: string
          user_id: string
          voting_power_multiplier: number
          wallet_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          stake_duration: number
          stake_end_date: string
          stake_start_date?: string
          staked_amount: number
          updated_at?: string
          user_id: string
          voting_power_multiplier?: number
          wallet_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          stake_duration?: number
          stake_end_date?: string
          stake_start_date?: string
          staked_amount?: number
          updated_at?: string
          user_id?: string
          voting_power_multiplier?: number
          wallet_id?: string | null
        }
        Relationships: []
      }
      topic_creation_jobs: {
        Row: {
          claimed_at: string | null
          completed_at: string | null
          created_at: string
          duration: number | null
          error: string | null
          id: string
          market_id: string | null
          max_retries: number
          mirror_node_checked_at: string | null
          mirror_node_retry_count: number | null
          request_id: string
          retry_count: number
          scheduled_for: string | null
          status: string
          submitted_at: string | null
          topic_id: string | null
          topic_type: string
          transaction_id: string | null
          updated_at: string
          worker_id: string | null
        }
        Insert: {
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string
          duration?: number | null
          error?: string | null
          id?: string
          market_id?: string | null
          max_retries?: number
          mirror_node_checked_at?: string | null
          mirror_node_retry_count?: number | null
          request_id: string
          retry_count?: number
          scheduled_for?: string | null
          status?: string
          submitted_at?: string | null
          topic_id?: string | null
          topic_type: string
          transaction_id?: string | null
          updated_at?: string
          worker_id?: string | null
        }
        Update: {
          claimed_at?: string | null
          completed_at?: string | null
          created_at?: string
          duration?: number | null
          error?: string | null
          id?: string
          market_id?: string | null
          max_retries?: number
          mirror_node_checked_at?: string | null
          mirror_node_retry_count?: number | null
          request_id?: string
          retry_count?: number
          scheduled_for?: string | null
          status?: string
          submitted_at?: string | null
          topic_id?: string | null
          topic_type?: string
          transaction_id?: string | null
          updated_at?: string
          worker_id?: string | null
        }
        Relationships: []
      }
      user_favorite_markets: {
        Row: {
          created_at: string | null
          id: string
          market_id: string
          wallet_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          market_id: string
          wallet_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          market_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_favorite_markets_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "event_markets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_token_balances: {
        Row: {
          created_at: string
          id: string
          last_updated: string
          staked_balance: number
          token_balance: number
          total_voting_power: number
          user_id: string
          wallet_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          last_updated?: string
          staked_balance?: number
          token_balance?: number
          total_voting_power?: number
          user_id: string
          wallet_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          last_updated?: string
          staked_balance?: number
          token_balance?: number
          total_voting_power?: number
          user_id?: string
          wallet_id?: string | null
        }
        Relationships: []
      }
      voting_power_snapshots: {
        Row: {
          created_at: string
          id: string
          proposal_id: string | null
          snapshot_date: string
          staked_balance: number
          token_balance: number
          total_voting_power: number
          user_id: string
          wallet_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          proposal_id?: string | null
          snapshot_date: string
          staked_balance: number
          token_balance: number
          total_voting_power: number
          user_id: string
          wallet_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          proposal_id?: string | null
          snapshot_date?: string
          staked_balance?: number
          token_balance?: number
          total_voting_power?: number
          user_id?: string
          wallet_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voting_power_snapshots_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "market_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_topic_jobs:
        | {
            Args: { limit_count: number }
            Returns: {
              claimed_at: string | null
              completed_at: string | null
              created_at: string
              duration: number | null
              error: string | null
              id: string
              market_id: string | null
              max_retries: number
              mirror_node_checked_at: string | null
              mirror_node_retry_count: number | null
              request_id: string
              retry_count: number
              scheduled_for: string | null
              status: string
              submitted_at: string | null
              topic_id: string | null
              topic_type: string
              transaction_id: string | null
              updated_at: string
              worker_id: string | null
            }[]
            SetofOptions: {
              from: "*"
              to: "topic_creation_jobs"
              isOneToOne: false
              isSetofReturn: true
            }
          }
        | {
            Args: { limit_count: number; p_worker_id?: string }
            Returns: {
              claimed_at: string | null
              completed_at: string | null
              created_at: string
              duration: number | null
              error: string | null
              id: string
              market_id: string | null
              max_retries: number
              mirror_node_checked_at: string | null
              mirror_node_retry_count: number | null
              request_id: string
              retry_count: number
              scheduled_for: string | null
              status: string
              submitted_at: string | null
              topic_id: string | null
              topic_type: string
              transaction_id: string | null
              updated_at: string
              worker_id: string | null
            }[]
            SetofOptions: {
              from: "*"
              to: "topic_creation_jobs"
              isOneToOne: false
              isSetofReturn: true
            }
          }
      create_candidate_binary_options: {
        Args: {
          p_candidate_avatar?: string
          p_candidate_metadata?: Json
          p_candidate_name: string
          p_candidate_party?: string
          p_market_id: string
        }
        Returns: {
          no_option_id: string
          yes_option_id: string
        }[]
      }
      create_default_binary_options: { Args: never; Returns: undefined }
      create_topic_job: {
        Args: { p_market_id?: string; p_topic_type: string }
        Returns: string
      }
      get_processing_state: {
        Args: { process_name_param: string }
        Returns: {
          created_at: string
          last_processed_index: number
          last_updated: string
          process_name: string
          total_items: number
        }[]
      }
      is_wallet_owner: { Args: { wallet_user_id: string }; Returns: boolean }
      manual_trigger_mirror_poller: { Args: never; Returns: Json }
      recalculate_proposal_vote_counts: { Args: never; Returns: undefined }
      set_primary_wallet: { Args: { wallet_id: string }; Returns: boolean }
      trigger_scheduled_mirror_poller: { Args: never; Returns: undefined }
    }
    Enums: {
      comment_position: "YES" | "NO"
      governance_status:
        | "draft"
        | "proposal"
        | "voting"
        | "election"
        | "approved"
        | "rejected"
        | "deployed"
      oracle_type: "chainlink" | "supra" | "api_endpoint" | "manual"
      proposal_type:
        | "market_creation"
        | "market_amendment"
        | "liquidity_incentive"
        | "governance_parameter"
      reaction_type: "like" | "dislike"
      report_status: "pending" | "reviewed" | "resolved"
      resolution_status: "open" | "closed" | "resolved" | "cancelled"
      vote_choice: "yes" | "no" | "abstain"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      comment_position: ["YES", "NO"],
      governance_status: [
        "draft",
        "proposal",
        "voting",
        "election",
        "approved",
        "rejected",
        "deployed",
      ],
      oracle_type: ["chainlink", "supra", "api_endpoint", "manual"],
      proposal_type: [
        "market_creation",
        "market_amendment",
        "liquidity_incentive",
        "governance_parameter",
      ],
      reaction_type: ["like", "dislike"],
      report_status: ["pending", "reviewed", "resolved"],
      resolution_status: ["open", "closed", "resolved", "cancelled"],
      vote_choice: ["yes", "no", "abstain"],
    },
  },
} as const
