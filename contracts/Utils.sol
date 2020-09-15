pragma solidity 0.6.6;

import "./IERC20.sol";


/**
 * @title Kyber utility file
 * mostly shared constants and rate calculation helpers
 * inherited by most of kyber contracts.
 * previous utils implementations are for previous solidity versions.
 */
contract Utils {
    IERC20 internal constant ETH_TOKEN_ADDRESS = IERC20(
        0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE
    );
    IERC20 internal constant USDT_TOKEN_ADDRESS = IERC20(
        0xdAC17F958D2ee523a2206206994597C13D831ec7
    );
    IERC20 internal constant DAI_TOKEN_ADDRESS = IERC20(
        0x6B175474E89094C44Da98b954EedeAC495271d0F
    );
    IERC20 internal constant USDC_TOKEN_ADDRESS = IERC20(
        0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48
    );
    IERC20 internal constant WBTC_TOKEN_ADDRESS = IERC20(
        0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599
    );
    IERC20 internal constant KNC_TOKEN_ADDRESS = IERC20(
        0xdd974D5C2e2928deA5F71b9825b8b646686BD200
    );
    uint256 public constant BPS = 10000; // Basic Price Steps. 1 step = 0.01%
    uint256 internal constant PRECISION = (10**18);
    uint256 internal constant MAX_QTY = (10**28); // 10B tokens
    uint256 internal constant MAX_RATE = (PRECISION * 10**7); // up to 10M tokens per eth
    uint256 internal constant MAX_DECIMALS = 18;
    uint256 internal constant ETH_DECIMALS = 18;
    uint256 internal constant MAX_ALLOWANCE = uint256(-1); // token.approve inifinite

    mapping(IERC20 => uint256) internal decimals;

    function updateDecimals(IERC20 token) internal returns (uint256) {
        // return token decimals if handled by token switch
        uint256 tokenDecimals = tokenSwitch(token);
        if (tokenDecimals > 0) return tokenDecimals;

        // handle case where token decimals is not a declared constant
        tokenDecimals = decimals[token];
        // moreover, very possible that old tokens have decimals 0
        // these tokens will just have higher gas fees.
        if (tokenDecimals == 0) {
            tokenDecimals = token.decimals();
            decimals[token] = tokenDecimals;
        }

        return tokenDecimals;
    }

    /// @dev save storage access by declaring token decimal constants
    /// @param token The token type
    /// @return token decimals
    function tokenSwitch(IERC20 token) internal pure returns (uint256) {
        if (token == ETH_TOKEN_ADDRESS) {
            return ETH_DECIMALS;
        } else if (token == USDT_TOKEN_ADDRESS) {
            return 6;
        } else if (token == DAI_TOKEN_ADDRESS) {
            return 18;
        } else if (token == USDC_TOKEN_ADDRESS) {
            return 6;
        } else if (token == WBTC_TOKEN_ADDRESS) {
            return 8;
        } else if (token == KNC_TOKEN_ADDRESS) {
            return 18;
        } else {
            return 0;
        }
    }

    /// @dev get the balance of a user.
    /// @param token The token type
    /// @return The balance
    function getBalance(IERC20 token, address user) internal view returns (uint256) {
        if (token == ETH_TOKEN_ADDRESS) {
            return user.balance;
        } else {
            return token.balanceOf(user);
        }
    }

    function getDecimals(IERC20 token) internal view returns (uint256) {
        // return token decimals if handled by token switch
        uint256 tokenDecimals = tokenSwitch(token);
        if (tokenDecimals > 0) return tokenDecimals;

        // handle case where token decimals is not a declared constant
        tokenDecimals = decimals[token];
        // moreover, very possible that old tokens have decimals 0
        // these tokens will just have higher gas fees.
        if (tokenDecimals == 0) {
            tokenDecimals = token.decimals();
        }

        return tokenDecimals;
    }

    function calcDestAmount(
        IERC20 src,
        IERC20 dest,
        uint256 srcAmount,
        uint256 rate
    ) internal view returns (uint256) {
        return calcDstQty(srcAmount, getDecimals(src), getDecimals(dest), rate);
    }

    function calcSrcAmount(
        IERC20 src,
        IERC20 dest,
        uint256 destAmount,
        uint256 rate
    ) internal view returns (uint256) {
        return calcSrcQty(destAmount, getDecimals(src), getDecimals(dest), rate);
    }

    function calcDstQty(
        uint256 srcQty,
        uint256 srcDecimals,
        uint256 dstDecimals,
        uint256 rate
    ) internal pure returns (uint256) {
        require(srcQty <= MAX_QTY, "srcQty > MAX_QTY");
        require(rate <= MAX_RATE, "rate > MAX_RATE");

        if (dstDecimals >= srcDecimals) {
            require((dstDecimals - srcDecimals) <= MAX_DECIMALS, "dst - src > MAX_DECIMALS");
            return (srcQty * rate * (10**(dstDecimals - srcDecimals))) / PRECISION;
        } else {
            require((srcDecimals - dstDecimals) <= MAX_DECIMALS, "src - dst > MAX_DECIMALS");
            return (srcQty * rate) / (PRECISION * (10**(srcDecimals - dstDecimals)));
        }
    }

    function calcSrcQty(
        uint256 dstQty,
        uint256 srcDecimals,
        uint256 dstDecimals,
        uint256 rate
    ) internal pure returns (uint256) {
        require(dstQty <= MAX_QTY, "dstQty > MAX_QTY");
        require(rate <= MAX_RATE, "rate > MAX_RATE");

        //source quantity is rounded up. to avoid dest quantity being too low.
        uint256 numerator;
        uint256 denominator;
        if (srcDecimals >= dstDecimals) {
            require((srcDecimals - dstDecimals) <= MAX_DECIMALS, "src - dst > MAX_DECIMALS");
            numerator = (PRECISION * dstQty * (10**(srcDecimals - dstDecimals)));
            denominator = rate;
        } else {
            require((dstDecimals - srcDecimals) <= MAX_DECIMALS, "dst - src > MAX_DECIMALS");
            numerator = (PRECISION * dstQty);
            denominator = (rate * (10**(dstDecimals - srcDecimals)));
        }
        return (numerator + denominator - 1) / denominator; //avoid rounding down errors
    }

    function calcRateFromQty(
        uint256 srcAmount,
        uint256 destAmount,
        uint256 srcDecimals,
        uint256 dstDecimals
    ) internal pure returns (uint256) {
        require(srcAmount <= MAX_QTY, "srcAmount > MAX_QTY");
        require(destAmount <= MAX_QTY, "destAmount > MAX_QTY");

        if (dstDecimals >= srcDecimals) {
            require((dstDecimals - srcDecimals) <= MAX_DECIMALS, "dst - src > MAX_DECIMALS");
            return ((destAmount * PRECISION) / ((10**(dstDecimals - srcDecimals)) * srcAmount));
        } else {
            require((srcDecimals - dstDecimals) <= MAX_DECIMALS, "src - dst > MAX_DECIMALS");
            return ((destAmount * PRECISION * (10**(srcDecimals - dstDecimals))) / srcAmount);
        }
    }

    function minOf(uint256 x, uint256 y) internal pure returns (uint256) {
        return x > y ? y : x;
    }
}
