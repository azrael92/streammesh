"""
Thinkorswim‐Style Put-Option Strategy in Python

This script implements a Python version of the “buy/sell puts based on technical indicators”
strategy described for Thinkorswim. It uses Yahoo Finance (via yfinance) to fetch
underlying price data and option chains, and pandas/ta (or manual formulas) to compute
RSI, MACD, EMAs, and Bollinger Bands. Implied Volatility Rank (IVR) and option Greeks
(e.g., delta) are approximated or left as placeholders—you can plug in a dedicated IV
data source or a Greeks library (e.g., py_vollib) as needed.

Dependencies:
  - pandas
  - numpy
  - yfinance
  - ta (for technical indicators)
  - datetime
  - typing

Install with:
  pip install pandas numpy yfinance ta

Usage:
  1. Adjust the `SYMBOLS` list for the tickers you want to scan (e.g., ['PLTR', 'NVDA']).
  2. Set your account parameters (e.g., `ACCOUNT_CAPITAL`) and risk parameters.
  3. Run the script daily (or on your schedule) to print buy/sell signals and candidate
     option contracts for puts.
  4. Integrate the generated signals into a broker API or paper‐trade engine of your choice.
"""

import pandas as pd
import numpy as np
import yfinance as yf
import ta
from datetime import datetime, timedelta
from typing import List, Dict, Any, Tuple

# ----------------------------
# User‐Adjustable Parameters
# ----------------------------

SYMBOLS = ["PLTR", "NVDA"]        # Underlyings to scan
ACCOUNT_CAPITAL = 100_000         # Total account capital ($)
MAX_RISK_PER_TRADE = 0.02         # Max % of capital per trade (2%)
MIN_OI = 500                      # Minimum open interest filter
MAX_BID_ASK_SPREAD = 0.50         # Max bid‐ask spread ($)
IVR_THRESHOLD_ENTER = 50         # Minimum IV Rank % to enter
IVR_THRESHOLD_EXIT = 30          # IV Rank % to exit
RSI_LENGTH = 14                   # RSI period
MACD_FAST = 12                    # MACD fast EMA
MACD_SLOW = 26                    # MACD slow EMA
MACD_SIGNAL = 9                   # MACD signal EMA
EMA_FAST = 50                     # Fast EMA length
EMA_SLOW = 200                    # Slow EMA length
BB_LENGTH = 20                    # Bollinger Bands period
BB_STD = 2                        # Bollinger Bands standard deviations

# Option selection criteria
PUT_DELTA_TARGET = 0.30           # Approximate delta for buying puts
PUT_DELTA_RANGE = 0.05            # ± range around target delta
PUT_MIN_DTE = 7                   # Minimum days to expiration for short‐term puts
PUT_MAX_DTE = 30                  # Maximum days to expiration for directional puts
PUT_LONG_DTE = 45                 # Minimum DTE for premium selling
STRIKE_OTM_PERCENT = 0.10         # 10% OTM strikes for directional puts

# Exit criteria for open put positions
EXIT_RSI_THRESHOLD = 50           # Exit if RSI < 50
EXIT_MACD_HIST_POS = True         # Exit if MACD histogram > 0
EXIT_IVR_THRESHOLD = 30           # Exit if IV Rank < 30
EXIT_DAYS_TO_EXPIRY = 5           # Close 5 days before expiration

# ----------------------------
# Utility Functions
# ----------------------------

def get_historical_data(symbol: str, period: str = "1y", interval: str = "1d") -> pd.DataFrame:
    """
    Fetch historical OHLCV data for `symbol` over the given `period` at `interval`.
    Returns a DataFrame with columns: ['Open','High','Low','Close','Volume'].
    """
    ticker = yf.Ticker(symbol)
    df = ticker.history(period=period, interval=interval)
    df = df.dropna(subset=["Close"])
    return df


def compute_indicators(df: pd.DataFrame) -> pd.DataFrame:
    """
    Compute RSI, MACD, EMAs, Bollinger Bands, and placeholder for IV Rank.
    Returns df with additional columns:
      - 'RSI'
      - 'MACD_hist'
      - 'EMA50'
      - 'EMA200'
      - 'BB_upper', 'BB_lower', 'BB_pct'
      - 'IVR' (Implied Volatility Rank placeholder: NaN)
    """
    df = df.copy()
    # RSI
    df["RSI"] = ta.momentum.RSIIndicator(close=df["Close"], window=RSI_LENGTH).rsi()

    # MACD Histogram
    macd = ta.trend.MACD(close=df["Close"],
                        window_slow=MACD_SLOW,
                        window_fast=MACD_FAST,
                        window_sign=MACD_SIGNAL)
    df["MACD_hist"] = macd.macd_diff()

    # EMAs
    df["EMA50"] = ta.trend.EMAIndicator(close=df["Close"], window=EMA_FAST).ema_indicator()
    df["EMA200"] = ta.trend.EMAIndicator(close=df["Close"], window=EMA_SLOW).ema_indicator()

    # Bollinger Bands
    bb = ta.volatility.BollingerBands(close=df["Close"], window=BB_LENGTH, window_dev=BB_STD)
    df["BB_upper"] = bb.bollinger_hband()
    df["BB_lower"] = bb.bollinger_lband()
    # %B = (Close - LowerBand) / (UpperBand - LowerBand)
    df["BB_pct"] = (df["Close"] - df["BB_lower"]) / (df["BB_upper"] - df["BB_lower"])

    # Placeholder for Implied Volatility Rank (IVR)
    df["IVR"] = np.nan  # Replace with actual IVR data if available

    return df


def get_iv_rank(symbol: str) -> float:
    """
    Placeholder function: return current Implied Volatility Rank for `symbol` as a percentage.
    In practice, fetch from a data vendor or compute from historical option vol.
    """
    # TODO: Replace with real IVR lookup
    return np.nan


def is_tight_bollinger(df: pd.DataFrame, idx: int) -> bool:
    """
    Check if Bollinger Band %B is below a threshold (tight squeeze) at index `idx`.
    Bollinger “squeeze”: BB_pct between 0.4 and 0.6 AND (BB_upper - BB_lower) / price < 0.05.
    """
    if idx < BB_LENGTH:
        return False
    upper = df.loc[df.index[idx], "BB_upper"]
    lower = df.loc[df.index[idx], "BB_lower"]
    close = df.loc[df.index[idx], "Close"]
    width = (upper - lower) / close
    return width < 0.05


def generate_signals(df: pd.DataFrame) -> pd.DataFrame:
    """
    For each date in df, generate:
      - 'Signal_BuyPut' (True/False)
      - 'Signal_SellPut' (True/False)
    based on the rules from the strategy.
    """
    df = df.copy()
    df["Signal_BuyPut"] = False
    df["Signal_SellPut"] = False

    for i in range(len(df)):
        # Skip if insufficient history
        if i < max(RSI_LENGTH, EMA_SLOW, BB_LENGTH):
            continue

        rsi = df["RSI"].iat[i]
        macd_hist = df["MACD_hist"].iat[i]
        close = df["Close"].iat[i]
        today = df.index[i]

        ema50 = df["EMA50"].iat[i]
        ivr = get_iv_rank(df.index[i] if False else None)  # Replace with symbol lookup

        # BUY PUT Conditions:
        # A) Overbought RSI + price below EMA50 + MACD hist < 0
        cond_a = (rsi > 70) and (close < ema50) and (macd_hist < 0)

        # B) Bollinger Tight & breakdown
        tight = is_tight_bollinger(df, i)
        breakdown = close < df["BB_lower"].iat[i]
        cond_b = tight and breakdown

        # C) High IVR (volatility environment)
        cond_c = (ivr is not None) and (ivr > IVR_THRESHOLD_ENTER)

        if (cond_a or cond_b) and cond_c:
            df.at[today, "Signal_BuyPut"] = True

        # SELL PUT Conditions:
        # D) Price crosses back above EMA50 & RSI < 50
        cond_d = (close > ema50) and (rsi < EXIT_RSI_THRESHOLD)

        # E) IV Rank has fallen
        cond_e = (ivr is not None) and (ivr < IVR_THRESHOLD_EXIT)

        # F) MACD hist turns positive
        cond_f = macd_hist > 0

        # G) Within EXIT_DAYS_TO_EXPIRY of expiration: handled outside in position manager
        if cond_d or cond_e or cond_f:
            df.at[today, "Signal_SellPut"] = True

    return df


def fetch_option_chain(symbol: str, as_of: datetime = None) -> pd.DataFrame:
    """
    Fetch the option chain for `symbol` using yfinance.
    Returns a DataFrame with columns:
      ['contractSymbol', 'lastTradeDate', 'strike', 'lastPrice', 'bid', 'ask',
       'change', 'percentChange', 'volume', 'openInterest', 'impliedVolatility',
       'inTheMoney', 'expiration', 'type', 'delta'].

    Note: yfinance does not return delta directly. You can compute delta via a Greeks library.
    This function will return the raw chain plus a NaN 'delta' column as a placeholder.
    """
    ticker = yf.Ticker(symbol)
    exp_dates = ticker.options  # list of expiration dates (strings in 'YYYY-MM-DD')
    records = []

    for exp in exp_dates:
        if as_of:
            exp_date = datetime.strptime(exp, "%Y-%m-%d")
            if exp_date < as_of:
                continue

        opt = ticker.option_chain(exp)
        for side, df_side in zip(["call", "put"], [opt.calls, opt.puts]):
            df_side = df_side.copy()
            df_side["type"] = side
            df_side["expiration"] = exp
            df_side["delta"] = np.nan  # Placeholder
            records.append(df_side)

    if not records:
        return pd.DataFrame()

    options_df = pd.concat(records, ignore_index=True)
    # Convert expiration to datetime
    options_df["expiration"] = pd.to_datetime(options_df["expiration"])
    return options_df


def estimate_delta(symbol: str, strike: float, expiry: datetime, option_type: str) -> float:
    """
    Placeholder: estimate option delta using a simple approximation or a Greeks library
    (e.g., py_vollib). Returns a delta between 0 and 1 for calls, 0 to -1 for puts.
    """
    # TODO: Replace with actual Black-Scholes or binomial-approximation
    return np.nan


def filter_put_candidates(options_df: pd.DataFrame,
                          underlying_price: float,
                          current_date: datetime) -> pd.DataFrame:
    """
    From options_df, filter to candidate puts that meet:
      - Type == 'put'
      - DTE between PUT_MIN_DTE and PUT_MAX_DTE
      - Strike between (1 - STRIKE_OTM_PERCENT)*Price and Price
      - Delta within PUT_DELTA_TARGET ± PUT_DELTA_RANGE
      - OpenInterest > MIN_OI
      - (ask - bid) < MAX_BID_ASK_SPREAD
      - IVR > IVR_THRESHOLD_ENTER (on underlying)
    Returns a DataFrame of candidate put contracts ordered by
      descending 'delta/strike' (i.e., expected shares per capital).
    """
    df = options_df.copy()
    df = df[df["type"] == "put"].copy()
    df["DTE"] = (df["expiration"] - current_date).dt.days
    df = df[(df["DTE"] >= PUT_MIN_DTE) & (df["DTE"] <= PUT_MAX_DTE)]

    lower_strike = underlying_price * (1 - STRIKE_OTM_PERCENT)
    df = df[(df["strike"] >= lower_strike) & (df["strike"] <= underlying_price)]

    # Estimate delta if not present
    # df["delta"] = df.apply(lambda row: estimate_delta(symbol, row["strike"], row["expiration"], "put"), axis=1)

    df = df[(df["delta"].notna()) &
            (df["delta"].between(PUT_DELTA_TARGET - PUT_DELTA_RANGE,
                                 PUT_DELTA_TARGET + PUT_DELTA_RANGE)) &
            (df["openInterest"] > MIN_OI) &
            ((df["ask"] - df["bid"]) < MAX_BID_ASK_SPREAD)]

    # Rank by delta/strike (highest first)
    df["score"] = df["delta"] / df["strike"]
    df = df.sort_values(by="score", ascending=False)
    return df.reset_index(drop=True)


def filter_call_candidates(options_df: pd.DataFrame,
                           underlying_price: float,
                           current_date: datetime) -> pd.DataFrame:
    """
    Filter to candidate calls for covered-call harvesting:
      - Type == 'call'
      - DTE >= PUT_LONG_DTE (e.g., 45)
      - Strike > underlying_price
      - Delta < 0.10 (very OTM)
      - OpenInterest > MIN_OI
      - (ask - bid) < MAX_BID_ASK_SPREAD
    Rank by highest 'premium + delta*(strike - cost_basis)' if cost_basis is known,
    or simply by premium if you ignore cost basis.
    """
    df = options_df.copy()
    df = df[df["type"] == "call"].copy()
    df["DTE"] = (df["expiration"] - current_date).dt.days
    df = df[df["DTE"] >= PUT_LONG_DTE]
    df = df[df["strike"] > underlying_price]

    # df["delta"] = df.apply(lambda row: estimate_delta(symbol, row["strike"], row["expiration"], "call"), axis=1)

    df = df[(df["delta"].notna()) &
            (df["delta"] <= 0.10) &
            (df["openInterest"] > MIN_OI) &
            ((df["ask"] - df["bid"]) < MAX_BID_ASK_SPREAD)]

    # Score by premium + delta*(strike - cost_basis). For simplicity, ignore cost_basis:
    df["score"] = df["lastPrice"]  # prioritize highest premium
    df = df.sort_values(by="score", ascending=False)
    return df.reset_index(drop=True)


# ----------------------------
# Main Workflow
# ----------------------------

def run_daily_scan(as_of: datetime = None) -> None:
    """
    Main entry point for a daily scan. For each symbol, it:
      1. Fetches historical data and computes indicators.
      2. Generates buy/sell signals (Signal_BuyPut, Signal_SellPut).
      3. If BuyPut = True, fetch option chain and filter candidate puts.
      4. If SellPut = True, identify which open put to close (placeholder).
      5. If no open put but in “harvest mode,” fetch call candidates.
      6. Print out summary of “to‐do” trades for the day.
    """
    if as_of is None:
        as_of = datetime.now()

    for symbol in SYMBOLS:
        print(f"=== {symbol} ({as_of.date()}) ===")
        # 1. Historical data + indicators
        df = get_historical_data(symbol, period="1y", interval="1d")
        df = compute_indicators(df)

        # Use last row as “today”
        today_idx = df.index[-1]
        row = df.loc[today_idx]

        # 2. Check buy/sell signals
        signals = generate_signals(df)
        buy_signal = signals["Signal_BuyPut"].iat[-1]
        sell_signal = signals["Signal_SellPut"].iat[-1]

        underlying_price = row["Close"]
        ivr = get_iv_rank(symbol)

        # 3. Fetch option chain
        options_df = fetch_option_chain(symbol, as_of=as_of)

        # 4. If BuyPut, show top 3 put candidates
        if buy_signal:
            print("→ Signal: BUY PUT")
            puts = filter_put_candidates(options_df, underlying_price, as_of)
            if not puts.empty:
                print("Top 3 put candidates:")
                for idx, opt in puts.head(3).iterrows():
                    dte = opt["DTE"]
                    strike = opt["strike"]
                    premium = (opt["bid"] + opt["ask"]) / 2
                    delta = opt["delta"]
                    print(f"  • {opt['contractSymbol']} | DTE={dte} | Strike={strike} | "
                          f"Premium≈{premium:.2f} | Δ≈{delta:.2f}")
            else:
                print("  No eligible put contracts found.")

        # 5. If SellPut, show placeholder for which open put to close
        elif sell_signal:
            print("→ Signal: SELL (CLOSE) OPEN PUT(S)")
            print("  [Manually review open puts and exit per strategy rules.]")

        # 6. If neither, check harvest mode (i.e., assume ~900+ shares)
        else:
            print("→ No put entry/exit signal.")
            # Check approximate share count from your portfolio (placeholder)
            # shares_pltr = get_portfolio_shares("PLTR"), shares_nvda = get_portfolio_shares("NVDA")
            # For demo, assume pltr_shares >= 900 and nvda_shares >= 900
            shares_approx = 900
            if shares_approx >= 900:
                print("  In harvest mode. Suggest selling covered calls.")
                calls = filter_call_candidates(options_df, underlying_price, as_of)
                if not calls.empty:
                    print("Top 3 call candidates (OTM):")
                    for idx, opt in calls.head(3).iterrows():
                        dte = opt["DTE"]
                        strike = opt["strike"]
                        premium = (opt["bid"] + opt["ask"]) / 2
                        delta = opt["delta"]
                        print(f"  • {opt['contractSymbol']} | DTE={dte} | Strike={strike} | "
                              f"Premium≈{premium:.2f} | Δ≈{delta:.2f}")
                else:
                    print("  No eligible call contracts found.")
            else:
                print("  Holding; no action recommended.")

        print()


# ----------------------------
# Example Execution
# ----------------------------
if __name__ == "__main__":
    # Run the daily scan for today
    run_daily_scan(as_of=datetime.now())
