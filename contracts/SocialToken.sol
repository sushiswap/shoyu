// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract SocialToken is Ownable {
    using SafeERC20 for IERC20;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
    event DividendCreated(IERC20 indexed token, uint256 indexed amount, uint256 indexed at);
    event DividendReceived(uint256 indexed id, address indexed to);

    struct Checkpoint {
        uint128 fromBlock;
        uint128 value;
    }

    struct Dividend {
        IERC20 token;
        uint256 amount;
        uint256 at;
    }

    uint256 public constant MINIMUM_DIVIDEND = 1000;

    string public name;
    string public symbol;
    uint8 public constant decimals = 18;

    mapping(address => mapping(address => uint256)) private _allowances;
    mapping(address => Checkpoint[]) internal _balances;
    Checkpoint[] _totalSupply;
    mapping(IERC20 => uint256) internal _tokenBalances;

    Dividend[] public dividends;
    mapping(uint256 => mapping(address => bool)) public dividendReceived;

    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _initialSupply
    ) {
        name = _name;
        symbol = _symbol;
        _mint(msg.sender, _initialSupply);
    }

    function totalSupply() public view returns (uint256) {
        return totalSupplyAt(block.number);
    }

    function totalSupplyAt(uint256 _blockNumber) public view returns (uint256) {
        return _valueAt(_totalSupply, _blockNumber);
    }

    function balanceOf(address _account) public view returns (uint256) {
        return balanceOfAt(_account, block.number);
    }

    function balanceOfAt(address _account, uint256 _blockNumber) public view returns (uint256) {
        return _valueAt(_balances[_account], _blockNumber);
    }

    function _valueAt(Checkpoint[] storage _checkpoints, uint256 _block) internal view returns (uint256) {
        if (_checkpoints.length == 0) return 0;

        // Shortcut for the actual value
        if (_block >= _checkpoints[_checkpoints.length - 1].fromBlock)
            return _checkpoints[_checkpoints.length - 1].value;
        if (_block < _checkpoints[0].fromBlock) return 0;

        // Binary search of the value in the array
        uint256 min = 0;
        uint256 max = _checkpoints.length - 1;
        while (max > min) {
            uint256 mid = (max + min + 1) / 2;
            if (_checkpoints[mid].fromBlock <= _block) {
                min = mid;
            } else {
                max = mid - 1;
            }
        }
        return _checkpoints[min].value;
    }

    function allowance(address owner, address spender) public view returns (uint256) {
        return _allowances[owner][spender];
    }

    function mint(address account, uint256 amount) external onlyOwner {
        _mint(account, amount);
    }

    function _mint(address account, uint256 amount) internal {
        require(account != address(0), "SocialToken: mint to the zero address");

        _updateValueAtNow(_totalSupply, _valueAt(_totalSupply, block.number) + amount);
        Checkpoint[] storage checkpoints = _balances[account];
        _updateValueAtNow(checkpoints, _valueAt(checkpoints, block.number) + amount);
        emit Transfer(address(0), account, amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        _approve(msg.sender, spender, amount);
        return true;
    }

    function transfer(address recipient, uint256 amount) external returns (bool) {
        _transfer(msg.sender, recipient, amount);
        return true;
    }

    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) external returns (bool) {
        _transfer(sender, recipient, amount);

        uint256 currentAllowance = _allowances[sender][msg.sender];
        require(currentAllowance >= amount, "SocialToken: transfer amount exceeds allowance");
        _approve(sender, msg.sender, currentAllowance - amount);

        return true;
    }

    function _approve(
        address owner,
        address spender,
        uint256 amount
    ) internal {
        require(owner != address(0), "SocialToken: approve from the zero address");
        require(spender != address(0), "SocialToken: approve to the zero address");

        _allowances[owner][spender] = amount;
        emit Approval(owner, spender, amount);
    }

    function _transfer(
        address sender,
        address recipient,
        uint256 amount
    ) internal {
        require(sender != address(0), "SocialToken: transfer from the zero address");
        require(recipient != address(0), "SocialToken: transfer to the zero address");

        Checkpoint[] storage senderCheckpoints = _balances[sender];
        uint256 senderBalance = _valueAt(senderCheckpoints, block.number);
        require(senderBalance >= amount, "SocialToken: transfer amount exceeds balance");
        _updateValueAtNow(senderCheckpoints, senderBalance - amount);

        Checkpoint[] storage recipientCheckpoints = _balances[recipient];
        _updateValueAtNow(recipientCheckpoints, _valueAt(recipientCheckpoints, block.number) - amount);

        emit Transfer(sender, recipient, amount);
    }

    function _updateValueAtNow(Checkpoint[] storage _checkpoints, uint256 _value) internal {
        if ((_checkpoints.length == 0) || (_checkpoints[_checkpoints.length - 1].fromBlock < block.number)) {
            Checkpoint storage newCheckPoint = _checkpoints.push();
            newCheckPoint.fromBlock = uint128(block.number);
            newCheckPoint.value = uint128(_value);
        } else {
            Checkpoint storage oldCheckPoint = _checkpoints[_checkpoints.length - 1];
            oldCheckPoint.value = uint128(_value);
        }
    }

    function createDividend(IERC20 token) external {
        uint256 amount = token.balanceOf(address(this)) - _tokenBalances[token];
        _createDividend(token, amount);
    }

    function createDividend(IERC20 token, uint256 amount) external {
        _createDividend(token, amount);
        token.safeTransferFrom(msg.sender, address(this), amount);
    }

    function _createDividend(IERC20 token, uint256 amount) internal {
        require(amount >= MINIMUM_DIVIDEND);
        dividends.push(Dividend(token, amount, block.number));
        _tokenBalances[token] += amount;

        emit DividendCreated(token, amount, block.number);
    }

    function receiveDividend(uint256 id) external {
        require(!dividendReceived[id][msg.sender], "SocialToken: already received");
        dividendReceived[id][msg.sender] = true;

        Dividend storage dividend = dividends[id];
        uint256 blockNumber = dividend.at;
        uint256 balanceAt = _valueAt(_balances[msg.sender], blockNumber);
        uint256 amount = (balanceAt * dividend.amount) / _valueAt(_totalSupply, blockNumber);
        require(amount > 0, "SocialToken: amount is 0");

        IERC20 token = dividend.token;
        _tokenBalances[token] -= amount;
        token.safeTransfer(msg.sender, amount);

        emit DividendReceived(id, msg.sender);
    }
}
