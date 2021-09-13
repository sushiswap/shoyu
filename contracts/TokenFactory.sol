// SPDX-License-Identifier: MIT

pragma solidity =0.8.3;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

import "./interfaces/ITokenFactory.sol";
import "./interfaces/IBaseNFT721.sol";
import "./interfaces/IBaseNFT1155.sol";
import "./interfaces/ISocialToken.sol";
import "./base/ProxyFactory.sol";
import "./libraries/Signature.sol";

contract TokenFactory is ProxyFactory, Ownable, ITokenFactory {
    uint8 public constant override MAX_ROYALTY_FEE = 250; // 25%
    uint8 public constant override MAX_OPERATIONAL_FEE = 50; // 5%
    // keccak256("ParkTokenIds721(address nft,uint256 toTokenId,uint256 nonce)");
    bytes32 public constant override PARK_TOKEN_IDS_721_TYPEHASH =
        0x3fddacac0a7d8b05f741f01ff6becadd9986be8631a2af41a675f365dd74090d;
    // keccak256("MintBatch721(address nft,address to,uint256[] tokenIds,bytes data,uint256 nonce)");
    bytes32 public constant override MINT_BATCH_721_TYPEHASH =
        0x884adba7f4e17962aed36c871036adea39c6d9f81fb25407a78db239e9731e86;
    // keccak256("MintBatch1155(address nft,address to,uint256[] tokenIds,uint256[] amounts,bytes data,uint256 nonce)");
    bytes32 public constant override MINT_BATCH_1155_TYPEHASH =
        0xb47ce0f6456fcc2f16b7d6e7b0255eb73822b401248e672a4543c2b3d7183043;
    // keccak256("MintSocialToken(address token,address to,uint256 amount,uint256 nonce)");
    bytes32 public constant override MINT_SOCIAL_TOKEN_TYPEHASH =
        0x8f4bf92e5271f5ec2f59dc3fc74368af0064fb84b40a3de9150dd26c08cda104;
    bytes32 internal immutable _DOMAIN_SEPARATOR;
    uint256 internal immutable _CACHED_CHAIN_ID;

    address[] internal _targets721;
    address[] internal _targets1155;
    address[] internal _targetsSocialToken;

    address internal _protocolFeeRecipient;
    uint8 internal _protocolFee; // out of 1000
    address internal _operationalFeeRecipient;
    uint8 internal _operationalFee; // out of 1000

    mapping(address => uint256) public override nonces;

    string public override baseURI721;
    string public override baseURI1155;

    address public override erc721Exchange;
    address public override erc1155Exchange;
    // any account can deploy proxies if isDeployerWhitelisted[0x0000000000000000000000000000000000000000] == true
    mapping(address => bool) public override isDeployerWhitelisted;
    mapping(address => bool) public override isStrategyWhitelisted;

    modifier onlyDeployer {
        require(isDeployerWhitelisted[address(0)] || isDeployerWhitelisted[msg.sender], "SHOYU: FORBIDDEN");
        _;
    }

    constructor(
        address protocolFeeRecipient,
        uint8 protocolFee,
        address operationalFeeRecipient,
        uint8 operationalFee,
        string memory _baseURI721,
        string memory _baseURI1155
    ) {
        _protocolFeeRecipient = protocolFeeRecipient;
        _protocolFee = protocolFee;
        _operationalFeeRecipient = operationalFeeRecipient;
        _operationalFee = operationalFee;

        baseURI721 = _baseURI721;
        baseURI1155 = _baseURI1155;

        _CACHED_CHAIN_ID = block.chainid;
        _DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                // keccak256('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')
                0x8b73c3c69bb8fe3d512ecc4cf759cc79239f7b179b0ffacaa9a75d522b39400f,
                keccak256(bytes(Strings.toHexString(uint160(address(this))))),
                0xc89efdaa54c0f20c7adf612882df0950f5a951637e0307cdcb4c672f298b8bc6, // keccak256(bytes("1"))
                block.chainid,
                address(this)
            )
        );
    }

    function DOMAIN_SEPARATOR() public view override returns (bytes32) {
        bytes32 domainSeparator;
        if (_CACHED_CHAIN_ID == block.chainid) domainSeparator = _DOMAIN_SEPARATOR;
        else {
            domainSeparator = keccak256(
                abi.encode(
                    // keccak256('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')
                    0x8b73c3c69bb8fe3d512ecc4cf759cc79239f7b179b0ffacaa9a75d522b39400f,
                    keccak256(bytes(Strings.toHexString(uint160(address(this))))),
                    0xc89efdaa54c0f20c7adf612882df0950f5a951637e0307cdcb4c672f298b8bc6, // keccak256(bytes("1"))
                    block.chainid,
                    address(this)
                )
            );
        }
        return domainSeparator;
    }

    function protocolFeeInfo() external view override returns (address recipient, uint8 permil) {
        return (_protocolFeeRecipient, _protocolFee);
    }

    function operationalFeeInfo() external view override returns (address recipient, uint8 permil) {
        return (_operationalFeeRecipient, _operationalFee);
    }

    // This function should be called with a proper param by a multi-sig `owner`
    function setBaseURI721(string memory uri) external override onlyOwner {
        baseURI721 = uri;

        emit SetBaseURI721(uri);
    }

    // This function should be called with a proper param by a multi-sig `owner`
    function setBaseURI1155(string memory uri) external override onlyOwner {
        baseURI1155 = uri;

        emit SetBaseURI1155(uri);
    }

    // This function should be called by a multi-sig `owner`, not an EOA
    function setProtocolFeeRecipient(address protocolFeeRecipient) external override onlyOwner {
        require(protocolFeeRecipient != address(0), "SHOYU: INVALID_FEE_RECIPIENT");

        _protocolFeeRecipient = protocolFeeRecipient;

        emit SetProtocolFeeRecipient(protocolFeeRecipient);
    }

    // This function should be called by a multi-sig `owner`, not an EOA
    function setOperationalFeeRecipient(address operationalFeeRecipient) external override onlyOwner {
        require(operationalFeeRecipient != address(0), "SHOYU: INVALID_RECIPIENT");

        _operationalFeeRecipient = operationalFeeRecipient;

        emit SetOperationalFeeRecipient(operationalFeeRecipient);
    }

    // This function should be called by a multi-sig `owner`, not an EOA
    function setOperationalFee(uint8 operationalFee) external override onlyOwner {
        require(operationalFee <= MAX_OPERATIONAL_FEE, "SHOYU: INVALID_FEE");

        _operationalFee = operationalFee;

        emit SetOperationalFee(operationalFee);
    }

    // This function should be called by a multi-sig `owner`, not an EOA
    function setDeployerWhitelisted(address deployer, bool whitelisted) external override onlyOwner {
        isDeployerWhitelisted[deployer] = whitelisted;

        emit SetDeployerWhitelisted(deployer, whitelisted);
    }

    // This function should be called by a multi-sig `owner`, not an EOA
    function setStrategyWhitelisted(address strategy, bool whitelisted) external override onlyOwner {
        require(strategy != address(0), "SHOYU: INVALID_ADDRESS");

        isStrategyWhitelisted[strategy] = whitelisted;

        emit SetStrategyWhitelisted(strategy, whitelisted);
    }

    // This function should be called by a multi-sig `owner`, not an EOA
    function upgradeNFT721(address newTarget) external override onlyOwner {
        _targets721.push(newTarget);

        emit UpgradeNFT721(newTarget);
    }

    // This function should be called by a multi-sig `owner`, not an EOA
    function upgradeNFT1155(address newTarget) external override onlyOwner {
        _targets1155.push(newTarget);

        emit UpgradeNFT1155(newTarget);
    }

    // This function should be called by a multi-sig `owner`, not an EOA
    function upgradeSocialToken(address newTarget) external override onlyOwner {
        _targetsSocialToken.push(newTarget);

        emit UpgradeSocialToken(newTarget);
    }

    // This function should be called by a multi-sig `owner`, not an EOA
    function upgradeERC721Exchange(address exchange) external override onlyOwner {
        erc721Exchange = exchange;

        emit UpgradeERC721Exchange(exchange);
    }

    // This function should be called by a multi-sig `owner`, not an EOA
    function upgradeERC1155Exchange(address exchange) external override onlyOwner {
        erc1155Exchange = exchange;

        emit UpgradeERC1155Exchange(exchange);
    }

    function deployNFT721AndMintBatch(
        address owner,
        string calldata name,
        string calldata symbol,
        uint256[] memory tokenIds,
        address royaltyFeeRecipient,
        uint8 royaltyFee
    ) external override onlyDeployer returns (address nft) {
        require(bytes(name).length > 0, "SHOYU: INVALID_NAME");
        require(bytes(symbol).length > 0, "SHOYU: INVALID_SYMBOL");
        require(owner != address(0), "SHOYU: INVALID_ADDRESS");

        nft = _createProxy(
            _targets721[_targets721.length - 1],
            abi.encodeWithSignature(
                "initialize(address,string,string,uint256[],address,uint8)",
                owner,
                name,
                symbol,
                tokenIds,
                royaltyFeeRecipient,
                royaltyFee
            )
        );

        emit DeployNFT721AndMintBatch(nft, owner, name, symbol, tokenIds, royaltyFeeRecipient, royaltyFee);
    }

    function deployNFT721AndPark(
        address owner,
        string calldata name,
        string calldata symbol,
        uint256 toTokenId,
        address royaltyFeeRecipient,
        uint8 royaltyFee
    ) external override onlyDeployer returns (address nft) {
        require(bytes(name).length > 0, "SHOYU: INVALID_NAME");
        require(bytes(symbol).length > 0, "SHOYU: INVALID_SYMBOL");
        require(owner != address(0), "SHOYU: INVALID_ADDRESS");

        nft = _createProxy(
            _targets721[_targets721.length - 1],
            abi.encodeWithSignature(
                "initialize(address,string,string,uint256,address,uint8)",
                owner,
                name,
                symbol,
                toTokenId,
                royaltyFeeRecipient,
                royaltyFee
            )
        );

        emit DeployNFT721AndPark(nft, owner, name, symbol, toTokenId, royaltyFeeRecipient, royaltyFee);
    }

    function isNFT721(address query) external view override returns (bool result) {
        if (query == address(0)) return false;
        for (uint256 i = _targets721.length; i >= 1; i--) {
            if (_isProxy(_targets721[i - 1], query)) {
                return true;
            }
        }
        return false;
    }

    function deployNFT1155AndMintBatch(
        address owner,
        uint256[] memory tokenIds,
        uint256[] memory amounts,
        address royaltyFeeRecipient,
        uint8 royaltyFee
    ) external override onlyDeployer returns (address nft) {
        require(owner != address(0), "SHOYU: INVALID_ADDRESS");
        require(tokenIds.length == amounts.length, "SHOYU: LENGTHS_NOT_EQUAL");
        nft = _createProxy(
            _targets1155[_targets1155.length - 1],
            abi.encodeWithSignature(
                "initialize(address,uint256[],uint256[],address,uint8)",
                owner,
                tokenIds,
                amounts,
                royaltyFeeRecipient,
                royaltyFee
            )
        );

        emit DeployNFT1155AndMintBatch(nft, owner, tokenIds, amounts, royaltyFeeRecipient, royaltyFee);
    }

    function isNFT1155(address query) external view override returns (bool result) {
        if (query == address(0)) return false;
        for (uint256 i = _targets1155.length; i >= 1; i--) {
            if (_isProxy(_targets1155[i - 1], query)) {
                return true;
            }
        }
        return false;
    }

    function deploySocialToken(
        address owner,
        string memory name,
        string memory symbol,
        address dividendToken,
        uint256 initialSupply
    ) external override onlyDeployer returns (address proxy) {
        require(bytes(name).length > 0, "SHOYU: INVALID_NAME");
        require(bytes(symbol).length > 0, "SHOYU: INVALID_SYMBOL");
        require(owner != address(0), "SHOYU: INVALID_ADDRESS");

        bytes memory initData =
            abi.encodeWithSignature(
                "initialize(address,string,string,address,uint256)",
                owner,
                name,
                symbol,
                dividendToken,
                initialSupply
            );
        proxy = _createProxy(_targetsSocialToken[_targetsSocialToken.length - 1], initData);

        emit DeploySocialToken(proxy, owner, name, symbol, dividendToken, initialSupply);
    }

    function isSocialToken(address query) external view override returns (bool result) {
        if (query == address(0)) return false;
        for (uint256 i = _targetsSocialToken.length; i >= 1; i--) {
            if (_isProxy(_targetsSocialToken[i - 1], query)) {
                return true;
            }
        }
        return false;
    }

    function parkTokenIds721(
        address nft,
        uint256 toTokenId,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external override {
        address owner = IBaseNFT721(nft).owner();
        bytes32 hash = keccak256(abi.encode(PARK_TOKEN_IDS_721_TYPEHASH, nft, toTokenId, nonces[owner]++));
        Signature.verify(hash, owner, v, r, s, DOMAIN_SEPARATOR());
        IBaseNFT721(nft).parkTokenIds(toTokenId);
    }

    function mintBatch721(
        address nft,
        address to,
        uint256[] calldata tokenIds,
        bytes calldata data,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external override {
        address owner = IBaseNFT721(nft).owner();
        bytes32 hash = keccak256(abi.encode(MINT_BATCH_721_TYPEHASH, nft, to, tokenIds, data, nonces[owner]++));
        Signature.verify(hash, owner, v, r, s, DOMAIN_SEPARATOR());
        IBaseNFT721(nft).mintBatch(to, tokenIds, data);
    }

    function mintBatch1155(
        address nft,
        address to,
        uint256[] calldata tokenIds,
        uint256[] calldata amounts,
        bytes calldata data,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external override {
        address owner = IBaseNFT1155(nft).owner();
        bytes32 hash =
            keccak256(abi.encode(MINT_BATCH_1155_TYPEHASH, nft, to, tokenIds, amounts, data, nonces[owner]++));
        Signature.verify(hash, owner, v, r, s, DOMAIN_SEPARATOR());
        IBaseNFT1155(nft).mintBatch(to, tokenIds, amounts, data);
    }

    function mintSocialToken(
        address token,
        address to,
        uint256 amount,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external override {
        address owner = ISocialToken(token).owner();
        bytes32 hash = keccak256(abi.encode(MINT_SOCIAL_TOKEN_TYPEHASH, token, to, amount, nonces[owner]++));
        Signature.verify(hash, owner, v, r, s, DOMAIN_SEPARATOR());
        ISocialToken(token).mint(to, amount);
    }
}
